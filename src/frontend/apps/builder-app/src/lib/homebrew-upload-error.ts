import { ApiError } from "@starlights/api-client";

/** Show validation guidance instead of an HTTP status followed by a JSON blob. */
export function homebrewUploadError(error: Error): string {
  if (!(error instanceof ApiError)) return error.message;
  if (error.status === 401 || error.status === 403) return "Unlock admin with the key button, then try again.";
  try {
    const body = JSON.parse(error.body) as { errors?: Record<string, unknown> | unknown[] };
    const messages = Object.values(body.errors ?? {}).flatMap((value) => Array.isArray(value) ? value : [value])
      .map((value: unknown) => typeof value === "string" ? value : value && typeof value === "object" && "reason" in value && typeof value.reason === "string" ? value.reason : null)
      .filter((value): value is string => !!value);
    if (messages.length) return [...new Set(messages)].join(" ");
  } catch { /* A proxy may return text instead of JSON. */ }
  return "The file could not be imported. Check that the server is available, then try again.";
}
