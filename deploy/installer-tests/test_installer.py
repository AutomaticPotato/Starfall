"""Disposable installer contract tests. Docker/HTTP are simulated, never production services."""
import argparse
import contextlib
import errno
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch, Mock
import urllib.error

SPEC = importlib.util.spec_from_file_location('installer', Path(__file__).resolve().parents[1] / 'installer.py')
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)


def state(running=False, succeeded=None, installed=False):
    return {'selfManaged': True, 'job': {'running': running, 'succeeded': succeeded},
            'status': {'lastSuccessAt': '2026-10-16' if installed else None}}


class FakeInstaller(m.Installer):
    def __init__(self, root, args):
        super().__init__(root, args)
        self.commands = []
        self.containers = []
        self.fail_build = False
        self.fail_start = False
        self.responses = [state(), {}, state(succeeded=True)]
        self.posts = []
        self.info = {'OSType': 'linux', 'Architecture': 'x86_64', 'MemTotal': 8 * m.GIB, 'DockerRootDir': '/not-mounted'}
        self.endpoint = 'unix:///var/run/docker.sock'

    def run(self, command, timeout=30):
        self.commands.append(command)
        if command[:3] == ['docker', 'context', 'inspect']:
            return json.dumps([{'Endpoints': {'docker': {'Host': self.endpoint}}}])
        if command[:2] == ['docker', 'info']:
            return json.dumps(self.info)
        if command[:2] == ['docker', 'ps']:
            return 'fixture' if self.containers else ''
        if command[:2] == ['docker', 'inspect']:
            return json.dumps(self.containers)
        if 'build' in command and self.fail_build:
            raise subprocess.TimeoutExpired(command, timeout)
        if 'up' in command and self.fail_start:
            raise subprocess.TimeoutExpired(command, timeout)
        return ''

    def request(self, path, data=None, timeout=10, authenticated=False):
        if path == '/api/characters/creation-options':
            return {}
        if data is not None:
            self.posts.append(data)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='starlights installer ')
        self.root = Path(self.temp.name) / 'deploy'
        self.root.mkdir()
        shutil.copy(Path(m.__file__).with_name('docker-compose.yml'), self.root)
        self.args = argparse.Namespace(check=False, skip_content=False, port=None)
        self.env = patch.dict(os.environ, {}, clear=True)
        self.env.start()
        self.platform = patch.object(m.platform, 'system', return_value='Linux')
        self.machine = patch.object(m.platform, 'machine', return_value='x86_64')
        self.release = patch.object(m.platform, 'release', return_value='6.8.0')
        self.disk = patch.object(m.shutil, 'disk_usage', return_value=Mock(free=30*m.GIB))
        self.which = patch.object(m.shutil, 'which', return_value='/usr/bin/docker')
        self.port = patch.object(m.Installer, 'check_port')
        for item in (self.platform, self.machine, self.release, self.disk, self.which, self.port):
            item.start()
            self.addCleanup(item.stop)
        self.addCleanup(self.env.stop)
        self.addCleanup(self.temp.cleanup)
        self.installer = FakeInstaller(self.root, self.args)

    def install(self, installer=None):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            result = (installer or self.installer).install()
        return result, output.getvalue()

    def credentials(self):
        values = m.new_env(self.root)
        m.write_env(self.root, values)
        return values

    def test_clean_install_and_repeat_preserve_credentials_and_user_data(self):
        result, output = self.install()
        self.assertEqual(result, 0, output)
        env = (self.root / '.env').read_bytes()
        user_data = self.root / 'data' / 'art' / 'character-sentinel.json'
        user_data.write_text('{"character":"synthetic-only","level":7}')
        content = self.root / 'data' / 'content' / 'sentinel'
        content.write_text('existing-content')
        second = FakeInstaller(self.root, self.args)
        second.responses = [state(installed=True)]
        result, output = self.install(second)
        self.assertEqual(result, 0, output)
        self.assertEqual(env, (self.root / '.env').read_bytes())
        self.assertEqual(user_data.read_text(), '{"character":"synthetic-only","level":7}')
        self.assertEqual(content.read_text(), 'existing-content')
        self.assertEqual(second.posts, [])
        self.assertEqual(stat.S_IMODE((self.root / '.env').stat().st_mode), 0o600)
        self.assertTrue(any('--no-recreate' in command for command in second.commands))
        for command in second.commands:
            self.assertNotIn('down', command)
            self.assertNotIn('--force-recreate', command)
            self.assertNotIn('chown -R', ' '.join(command))

    def test_check_changes_no_files_or_containers(self):
        self.args.check = True
        before = set(self.root.iterdir())
        self.assertEqual(self.install()[0], 0)
        self.assertEqual(set(self.root.iterdir()), before)
        self.assertFalse(any('run' in c or 'up' in c or 'build' in c for c in self.installer.commands))

    def test_interrupted_build_resumes_same_env(self):
        self.installer.fail_build = True
        result, output = self.install()
        self.assertEqual(result, 1)
        self.assertIn('image build', output)
        before = (self.root / '.env').read_bytes()
        self.installer.fail_build = False
        self.assertEqual(self.install()[0], 0)
        self.assertEqual(before, (self.root / '.env').read_bytes())

    def test_keyboard_interrupt_preserves_credentials_for_retry(self):
        original = self.installer.run
        def interrupt(command, timeout=30):
            if 'build' in command:
                raise KeyboardInterrupt
            return original(command, timeout)
        with patch.object(self.installer, 'run', side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.install()
        before = (self.root / '.env').read_bytes()
        self.assertEqual(self.install()[0], 0)
        self.assertEqual(before, (self.root / '.env').read_bytes())

    def test_complete_existing_install_does_not_build_or_import(self):
        self.credentials()
        self.installer.containers = [
            {'Config': {'Labels': {'com.docker.compose.project.working_dir': str(self.root),
                                   'com.docker.compose.service': service}}}
            for service in ('starlights-db', 'starlights-web', 'starlights-api',
                            'starlights-migrate-elements', 'starlights-migrate-characters')]
        self.installer.responses = [state(installed=True)]
        self.assertEqual(self.install()[0], 0)
        self.assertFalse(any('build' in command for command in self.installer.commands))
        self.assertEqual(self.installer.posts, [])

    def test_changed_project_refuses_second_database_on_same_data(self):
        self.assertEqual(self.install()[0], 0)
        path = self.root / '.env'
        values = m.read_env(path)
        path.write_text(path.read_text().replace(values['COMPOSE_PROJECT_NAME'], 'different-project'))
        second = FakeInstaller(self.root, self.args)
        result, output = self.install(second)
        self.assertEqual(result, 1)
        self.assertIn('second database', output)
        self.assertFalse(any('run' in c or 'up' in c or 'build' in c for c in second.commands))

    def test_docker_permission_failure_writes_nothing(self):
        original = self.installer.run
        def denied(command, timeout=30):
            if command[:2] == ['docker', 'info']:
                raise m.SetupError('permission denied')
            return original(command, timeout)
        with patch.object(self.installer, 'run', side_effect=denied):
            result, output = self.install()
        self.assertEqual(result, 1)
        self.assertIn('Cannot reach Docker', output)
        self.assertFalse((self.root / '.env').exists())

    def test_start_timeout_is_actionable_and_preserves_env(self):
        self.installer.fail_start = True
        result, output = self.install()
        self.assertEqual(result, 1)
        self.assertIn('startup / database migrations', output)
        self.assertTrue((self.root / '.env').exists())
        self.assertNotIn('Setup complete', output)

    def test_missing_env_with_data_refuses_generation(self):
        (self.root / 'data').mkdir()
        (self.root / 'data' / 'characters').write_text('keep')
        result, output = self.install()
        self.assertEqual(result, 1)
        self.assertIn('Restore the matching .env', output)
        self.assertFalse((self.root / '.env').exists())

    def test_empty_existing_env_is_never_replaced(self):
        (self.root / '.env').touch(mode=0o600)
        self.assertEqual(self.install()[0], 1)
        self.assertEqual((self.root / '.env').read_bytes(), b'')

    def test_env_permissions_fail_without_changes(self):
        self.credentials()
        (self.root / '.env').chmod(0o644)
        self.assertIn('chmod 600', self.install()[1])
        self.assertEqual(stat.S_IMODE((self.root / '.env').stat().st_mode), 0o644)

    def test_crlf_env_and_no_trailing_newline(self):
        values = self.credentials()
        path = self.root / '.env'
        path.write_bytes(path.read_bytes().replace(b'\n', b'\r\n').rstrip())
        self.assertEqual(m.read_env(path), values)

    def test_env_shell_substitution_and_duplicate_keys_rejected(self):
        self.credentials()
        path = self.root / '.env'
        original = path.read_text()
        for extra in ('EVIL=$(touch bad)\n', 'STARLIGHTS_PORT=9000\n', 'STARLIGHTS_PORT="9000"\n'):
            path.write_text(original + extra)
            self.assertEqual(self.install()[0], 1)
        self.assertFalse((self.root / 'bad').exists())

    def test_atomic_env_creation_does_not_overwrite(self):
        values = self.credentials()
        with self.assertRaises(FileExistsError):
            m.write_env(self.root, values)
        self.assertEqual(m.read_env(self.root / '.env'), values)
        self.assertEqual(list(self.root.glob('.setup-*.tmp')), [])

    def test_unique_secure_credentials_never_printed(self):
        result, output = self.install()
        self.assertEqual(result, 0)
        values = m.read_env(self.root / '.env')
        for key in m.SECRET_KEYS:
            self.assertGreaterEqual(len(values[key]), 48)
            self.assertNotIn(values[key], output)
            self.assertNotIn(values[key], str(self.installer.commands))
        self.assertEqual(len(set(values[key] for key in m.SECRET_KEYS)), 3)

    def test_env_and_data_symlinks_rejected(self):
        target = self.root / 'other'
        target.mkdir()
        (self.root / 'data').symlink_to(target)
        self.assertEqual(self.install()[0], 1)
        (self.root / 'data').unlink()
        (self.root / '.env').symlink_to(target / 'missing')
        self.assertEqual(self.install()[0], 1)

    def test_existing_data_child_symlink_rejected(self):
        self.credentials()
        (self.root / 'data').mkdir()
        (self.root / 'data' / 'mssql').symlink_to(self.root)
        self.assertIn('symlink', self.install()[1])

    def test_old_install_keeps_compose_default(self):
        values = self.credentials()
        path = self.root / '.env'
        path.write_text('\n'.join(f'{k}={v}' for k, v in values.items() if k != 'COMPOSE_PROJECT_NAME'))
        self.assertEqual(self.install()[0], 0)
        self.assertEqual(self.installer.project, 'deploy')

    def test_foreign_project_refused_before_mutations(self):
        self.installer.containers = [{'Config': {'Labels': {'com.docker.compose.project.working_dir': '/someone/else'}}}]
        self.assertIn('different directory', self.install()[1])
        self.assertFalse((self.root / '.env').exists())
        self.assertFalse(any('run' in c or 'build' in c or 'up' in c for c in self.installer.commands))

    def test_override_credentials_rejected(self):
        os.environ['STARLIGHTS_SA_PASSWORD'] = 'never-print-me'
        result, output = self.install()
        self.assertEqual(result, 1)
        self.assertNotIn('never-print-me', output)

    def test_new_install_custom_port_and_invalid_port(self):
        self.args.port = 18093
        self.assertEqual(self.install()[0], 0)
        self.assertEqual(m.read_env(self.root / '.env')['STARLIGHTS_PORT'], '18093')
        self.args.port = 18094
        self.assertIn('change STARLIGHTS_PORT in .env', self.install()[1])

    def test_invalid_port_rejected(self):
        self.args.port = 0
        self.assertEqual(self.install()[0], 1)
        self.assertFalse((self.root / '.env').exists())

    def test_arm_and_windows_containers_rejected(self):
        self.installer.info['Architecture'] = 'aarch64'
        self.assertIn('x86-64 Linux containers', self.install()[1])
        self.installer.info['Architecture'] = 'amd64'
        self.installer.info['OSType'] = 'windows'
        self.assertEqual(self.install()[0], 1)

    def test_missing_docker_and_low_memory_disk(self):
        with patch.object(m.shutil, 'which', return_value=None):
            self.assertIn('Docker is missing', self.install()[1])
        self.installer.info['MemTotal'] = 2*m.GIB
        self.assertIn('4 GB RAM', self.install()[1])
        self.installer.info['MemTotal'] = 8*m.GIB
        with patch.object(m.shutil, 'disk_usage', return_value=Mock(free=m.GIB)):
            self.assertIn('10 GB free disk', self.install()[1])

    def test_remote_docker_rejected(self):
        self.installer.endpoint = 'ssh://somewhere'
        self.assertIn('local Docker engine', self.install()[1])

    def test_wsl1_and_windows_filesystem_rejected(self):
        with patch.object(m.platform, 'release', return_value='4.4-Microsoft'):
            self.assertIn('WSL1', self.install()[1])
        with patch.object(m.platform, 'release', return_value='5.15-microsoft-standard-WSL2'):
            with patch.object(m.subprocess, 'check_output', return_value='9p\n'):
                self.assertIn('WSL Linux home', self.install()[1])

    def test_running_content_attaches_without_post(self):
        self.installer.responses = [state(running=True), state(succeeded=True)]
        self.assertEqual(self.install()[0], 0)
        self.assertEqual(self.installer.posts, [])

    def test_content_failure_retries_without_force_or_reset(self):
        self.installer.responses = [state(), {}, state(succeeded=False)]
        result, output = self.install()
        self.assertEqual(result, 2)
        self.assertIn('Starfall is running', output)
        self.assertNotIn('Setup complete', output)
        env = (self.root / '.env').read_bytes()
        self.installer.responses = [state(succeeded=False), {}, state(succeeded=True)]
        self.assertEqual(self.install()[0], 0)
        self.assertEqual((self.root / '.env').read_bytes(), env)
        self.assertEqual(self.installer.posts, [{'force': False}, {'force': False}])

    def test_content_conflict_attaches(self):
        conflict = urllib.error.HTTPError('http://localhost', 409, 'conflict', {}, None)
        self.installer.responses = [state(), conflict, state(succeeded=True)]
        self.assertEqual(self.install()[0], 0)

    def test_content_auth_error_payload_not_printed(self):
        self.installer.responses = [urllib.error.HTTPError('http://localhost', 401, 'secret-payload', {}, None)]
        result, output = self.install()
        self.assertEqual(result, 2)
        self.assertNotIn('secret-payload', output)

    def test_skip_content_makes_no_import_request(self):
        self.args.skip_content = True
        self.assertEqual(self.install()[0], 0)
        self.assertEqual(self.installer.posts, [])
        self.assertEqual(len(self.installer.responses), 3)

    def test_content_timeout_is_bounded(self):
        self.installer.values = m.new_env(self.root)
        self.installer.responses = [state(running=True)]
        with patch.object(m.time, 'monotonic', side_effect=[0, 0, 1801]):
            with self.assertRaisesRegex(m.SetupError, 'may still be running'):
                self.installer.content()

    def test_health_timeout_is_bounded(self):
        with patch.object(self.installer, 'request', side_effect=OSError):
            with patch.object(m.time, 'monotonic', side_effect=[0, 0, 0, 181, 181]):
                with patch.object(m.time, 'sleep'):
                    with self.assertRaisesRegex(m.SetupError, 'health check timed out'):
                        self.installer.health()

    def test_port_conflict_and_existing_owner(self):
        self.port.stop()
        fake_socket = Mock()
        fake_socket.__enter__ = Mock(return_value=fake_socket)
        fake_socket.__exit__ = Mock(return_value=False)
        fake_socket.bind.side_effect = OSError(errno.EADDRINUSE, 'busy')
        with patch.object(m.socket, 'socket', return_value=fake_socket):
            with self.assertRaisesRegex(m.SetupError, 'Port 8093 is unavailable'):
                self.installer.check_port()
            self.installer.existing = [{'Config': {'Labels': {'com.docker.compose.service': 'starlights-web'}},
                                      'State': {'Running': True},
                                      'NetworkSettings': {'Ports': {'80/tcp': [{'HostPort': '8093'}]}}}]
            self.installer.check_port()

    def test_subprocess_timeout_terminates_and_hides_output(self):
        real = m.Installer(self.root, self.args)
        with self.assertRaises(subprocess.TimeoutExpired):
            real.run([sys.executable, '-c', 'import time; print("secret"); time.sleep(60)'], timeout=.1)
        with self.assertRaises(m.SetupError) as error:
            real.run([sys.executable, '-c', 'print("secret"); raise SystemExit(1)'])
        self.assertNotIn('secret', str(error.exception))

    def test_directory_lock_blocks_a_second_installer(self):
        shutil.copy2(m.__file__, self.root / 'installer.py')
        lock = os.open(self.root, os.O_RDONLY)
        try:
            m.fcntl.flock(lock, m.fcntl.LOCK_EX | m.fcntl.LOCK_NB)
            result = subprocess.run([sys.executable, str(self.root / 'installer.py'), '--check'],
                                    capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 1)
            self.assertIn('Another setup is running', result.stdout)
            self.assertFalse((self.root / '.env').exists())
        finally:
            os.close(lock)

    def test_successful_stderr_does_not_corrupt_docker_json(self):
        real = m.Installer(self.root, self.args)
        result = real.run([sys.executable, '-c', 'import sys; print("{}"); print("warning", file=sys.stderr)'])
        self.assertEqual(json.loads(result), {})

    def test_container_permission_scripts_have_valid_posix_shell_syntax(self):
        self.assertEqual(self.install()[0], 0)
        for command in self.installer.commands:
            if 'sh' in command and '-c' in command:
                script = command[command.index('-c') + 1]
                subprocess.run(['/bin/sh', '-n', '-c', script], check=True, timeout=5)

    def test_invalid_timeout(self):
        os.environ['STARLIGHTS_SETUP_BUILD_TIMEOUT'] = 'forever'
        with self.assertRaisesRegex(m.SetupError, '1–86400'):
            m.Installer(self.root, self.args)


if __name__ == '__main__':
    unittest.main()
