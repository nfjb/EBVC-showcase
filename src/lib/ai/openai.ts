/**
 * One structured call to the OpenAI Responses API, shared by the server routes and the
 * demo-rating script. Server-only: it needs the key, which never reaches the browser.
 */

export const DEFAULT_MODEL = "gpt-6.1-sol";
const TIMEOUT_MS = 120_000;

/** A failure with the HTTP status the route should answer with, and a message fit to show. */
export class OpenAIError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function openAIModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

export function openAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new OpenAIError("No OpenAI key set. Add OPENAI_API_KEY to .env.local and restart the dev server.", 503);
  return key;
}

/** The model's text from a Responses API reply, or an error that says why there is none. */
export function responseText(reply: unknown): string {
  const body = reply as {
    output_text?: unknown;
    output?: { content?: { type?: string; text?: string; refusal?: string }[] }[];
  };
  if (typeof body?.output_text === "string") return body.output_text;
  for (const item of body?.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === "refusal") throw new OpenAIError(`The model declined: ${part.refusal ?? "no reason given"}`, 502);
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  throw new OpenAIError("The model returned no text.", 502);
}

/** Send a Responses API request body; return the model's JSON text. */
export async function callOpenAI(requestBody: Record<string, unknown>): Promise<string> {
  const key = openAIKey();
  let reply: Response;
  try {
    reply = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new OpenAIError(timedOut ? "OpenAI did not answer in time. Try again." : "Could not reach OpenAI.", 502);
  }
  const body = (await reply.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!reply.ok) {
    // OpenAI's own message (wrong key, unknown model, no credits…); never the key itself.
    throw new OpenAIError(`OpenAI error ${reply.status}: ${body?.error?.message ?? "no details"}`, 502);
  }
  return responseText(body);
}

/** Turn any failure into the JSON reply a route sends. */
export function errorResponse(error: unknown): Response {
  if (error instanceof OpenAIError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: 502 });
}
