/**
 * POST /api/rate — the Fathom rating agent, live: rates up to 20 companies per call. The OpenAI
 * key stays on the server (``src/lib/ai/openai.ts``); nothing is stored.
 *
 * Body: ``{companies: AgentInput[]}`` (company-level information only).
 * Reply: ``{ratings, model}``, or ``{error}`` with 400 (bad request), 503 (no key) or 502.
 */

import { callOpenAI, errorResponse, openAIModel } from "@/lib/ai/openai";
import { agentRequest, cleanAgentInputs, parseAgentRatings } from "@/lib/triage/agentRating";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let inputs;
  try {
    inputs = cleanAgentInputs(await request.json());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unreadable request." }, { status: 400 });
  }
  try {
    const model = openAIModel();
    const text = await callOpenAI(agentRequest(model, inputs));
    return Response.json({ ratings: parseAgentRatings(text, inputs.map((input) => input.key)), model });
  } catch (error) {
    return errorResponse(error);
  }
}
