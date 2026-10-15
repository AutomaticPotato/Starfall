#!/usr/bin/env python3
"""Opt-in real Docker smoke test, with unique images/project and disposable synthetic SQL data."""
import argparse
import hashlib
import importlib.util
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import uuid


def run(command, **kwargs):
    return subprocess.run(command, check=True, timeout=kwargs.pop('timeout', 60), **kwargs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', action='store_true', help='build/start only the disposable test installation; requires Docker access')
    parser.add_argument('--keep', action='store_true', help='keep the stopped test checkout and synthetic data for inspection')
    args = parser.parse_args()
    if not args.run:
        parser.print_help()
        return 0
    # Fail before making any test files or Docker changes when the daemon is unavailable.
    try:
        run(['docker', 'info', '--format', '{{.OSType}}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (subprocess.SubprocessError, OSError):
        print('BLOCKED: Docker is unavailable to this user/session. No test containers or files were created.')
        return 1
    source = Path(__file__).resolve().parents[2]
    project = 'starlights-installer-test-' + uuid.uuid4().hex[:12]
    directory = Path(tempfile.mkdtemp(prefix=project + '-'))
    checkout = directory / 'checkout'
    checkout.mkdir()
    compose = []
    cleaned = False
    try:
        # Copy only Git-tracked source, never ignored .env, data, node_modules or another worktree.
        files = subprocess.check_output(['git', '-C', str(source), 'ls-files', '-z']).decode().split('\0')
        for name in filter(None, files):
            original = source / name
            if original.is_symlink():
                raise RuntimeError('Refusing a source checkout containing symbolic links.')
            target = checkout / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(original, target)
        deploy = checkout / 'deploy'
        config = deploy / 'docker-compose.yml'
        text = config.read_text()
        # Images are named after COMPOSE_PROJECT_NAME (set to this test's unique project below), so the test images
        # are {project}/backend and {project}/web without rewriting; refuse to run if that isolation is gone.
        if ('image: ${COMPOSE_PROJECT_NAME:-starlights}/backend' not in text
                or 'image: ${COMPOSE_PROJECT_NAME:-starlights}/web' not in text):
            raise RuntimeError('Compose images are not named per project; review smoke-test isolation before proceeding.')
        for old, new in [('"${STARLIGHTS_PORT:-8093}:80"', '"127.0.0.1:${STARLIGHTS_PORT:-8093}:80"')]:
            if old not in text:
                raise RuntimeError('Compose layout changed; review smoke-test isolation before proceeding.')
            text = text.replace(old, new)
        config.write_text(text)
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        spec = importlib.util.spec_from_file_location('test_installer', deploy / 'installer.py')
        helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(helper)
        values = helper.new_env(deploy)
        values.update(COMPOSE_PROJECT_NAME=project, STARLIGHTS_PORT=str(port))
        helper.write_env(deploy, values)
        env = dict(os.environ)
        # Prevent operator shell Compose overrides from selecting another project/configuration.
        for key in list(env):
            if key.startswith(('COMPOSE_', 'STARLIGHTS_')):
                del env[key]
        compose = ['docker', 'compose', '--project-directory', str(deploy), '--env-file', str(deploy / '.env'),
                   '-f', str(config), '-p', project]
        print(f'Disposable project: {project}\nCheckout: {checkout}\nBrowser: http://127.0.0.1:{port}', flush=True)
        command = [sys.executable, str(deploy / 'installer.py'), '--skip-content']
        run(command, env=env, timeout=2400)
        print('PASS: clean Docker startup and web/API health', flush=True)
        digest = hashlib.sha256((deploy / '.env').read_bytes()).hexdigest()
        # SQLCMDPASSWORD keeps credentials out of sqlcmd arguments and test output.
        sql = compose + ['exec', '-T', 'starlights-db', 'sh', '-c',
                         'export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"; '
                         'exec /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -d starlights -b -h -1 -Q "$1"', 'probe']
        run(sql + ["CREATE TABLE dbo.InstallerSmoke (Id int PRIMARY KEY); INSERT dbo.InstallerSmoke VALUES (008);"],
            env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        run(command, env=env, timeout=2400)
        result = run(sql + ['SET NOCOUNT ON; SELECT Id FROM dbo.InstallerSmoke WHERE Id=8;'],
                     env=env, capture_output=True, text=True)
        if result.stdout.strip() != '8' or hashlib.sha256((deploy / '.env').read_bytes()).hexdigest() != digest:
            raise RuntimeError('Persistence or credential preservation failed.')
        print('PASS: repeated setup preserved credentials and synthetic SQL row', flush=True)
        # Simulate an interrupted installation with an existing, stopped test API. No other project is targeted.
        run(compose + ['stop', 'starlights-api'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        run(command, env=env, timeout=2400)
        result = run(sql + ['SET NOCOUNT ON; SELECT Id FROM dbo.InstallerSmoke WHERE Id=8;'],
                     env=env, capture_output=True, text=True)
        if result.stdout.strip() != '8':
            raise RuntimeError('Recovery lost the synthetic SQL row.')
        print('PASS: recovery with a stopped API preserved synthetic SQL data', flush=True)
        print('Content download and interactive browser workflows were not tested (--skip-content).', flush=True)
        return 0
    finally:
        if compose:
            try:
                # Scoped project cleanup; never use global prune, host service controls or production paths.
                run(compose + ['down', '--timeout', '20'], env=env,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
                # Remove only files under this runner's dedicated data mount, including SQL-owned files.
                if not args.keep:
                    run(['docker', 'run', '--rm', '--network', 'none', '--mount',
                         f'type=bind,src={deploy / "data"},dst=/test-data',
                         'alpine:3.21', 'sh', '-c', 'find /test-data -mindepth 1 -delete'],
                        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                cleaned = True
            except (subprocess.SubprocessError, OSError):
                print(f'Cleanup incomplete. Inspect only project {project} and {directory}; test files retained.')
            # Test-only tags; never remove the shared SQL/alpine/base images or build cache.
            subprocess.run(['docker', 'image', 'rm', f'{project}/backend', f'{project}/web'],
                           env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30, check=False)
        else:
            cleaned = True
        if cleaned and not args.keep:
            shutil.rmtree(directory)
        elif args.keep:
            print(f'Test checkout retained (containers stopped): {directory}')


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (subprocess.SubprocessError, OSError, RuntimeError):
        print('FAIL: disposable Docker smoke test did not finish. Raw command output is withheld to protect credentials.')
        sys.exit(1)
