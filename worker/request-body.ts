// Keep malformed, null and array payloads out of handlers that expect fields.
export async function readObjectBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > 100_000) throw new Error("Request body too large");
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  return value as Record<string, unknown>;
}
