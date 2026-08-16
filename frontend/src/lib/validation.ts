// Shared helper for Laravel-shaped 422 validation responses.
// apiFetch (see lib/api.ts) throws `Error & { status?: number; details?: any }`
// where `details` is the parsed JSON body, so `details.errors` is
// `{ field: [message, ...] }` on a validation failure.
export function parseValidationErrors(error: unknown): Record<string, string> {
  const details = (error as any)?.details;
  const errors = details?.errors;
  if (!errors || typeof errors !== "object") return {};

  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(errors)) {
    const msg = Array.isArray(messages) ? messages[0] : messages;
    if (typeof msg === "string") out[field] = msg;
  }
  return out;
}
