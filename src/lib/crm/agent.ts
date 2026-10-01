/**
 * The Fathom rating agent in the CRM. The demo companies come pre-rated from the bundled file
 * (``demo/fathom_ratings.json``, made offline by ``npm run demo:prerate``), applied after every
 * upload. Anything else is rated live by ``/api/rate`` (OpenAI), and only when a person
 * presses "Rate with the Fathom agent": it spends credits, so it never starts on its own.
 *
 * The agent never overwrites a person's ratings. Its ratings are recorded on the company
 * (rating_source, rating_model, rated_by, rated_at, rating_rationale), not in the audit log,
 * which stays the record of people's clicks.
 */

import bundled from "../../../demo/fathom_ratings.json";

import { atomic } from "@/lib/db/connection";
import * as repo from "@/lib/db/repository";
import { AGENT_BATCH, type AgentInput, type AgentRating } from "@/lib/triage/agentRating";
import { FATHOM_KEYS } from "@/lib/triage/scoring";

import { rescore } from "./triageActions";

export const AGENT_NAME = "Fathom agent";
const PARALLEL_BATCHES = 3;

interface BundledRatings {
  model: string | null;
  generated_at: string | null;
  ratings: Record<string, Record<string, unknown>>;
}

/** The agent's input per company id, from the latest pipeline run. */
let inputs = new Map<number, AgentInput>();

export function rememberAgentInputs(byCompanyId: Map<number, AgentInput>): void {
  inputs = byCompanyId;
  run += 1; // a new upload stops a live run for the old companies
  setStatus({ state: "idle", done: 0, total: 0, error: null });
}

/**
 * Put the agent's ratings on a company and rescore it. Returns false (and changes nothing)
 * when the company is gone or a person has already rated it.
 */
export function applyAgentRating(companyId: number, rating: AgentRating, model: string, ratedAt: string): boolean {
  return atomic(() => {
    const company = repo.getCompany(companyId);
    if (!company || company.rating_source === "person") return false;
    const ratings = { ...rating.ratings, storytelling_bonus: company.storytelling_bonus };
    repo.updateCompany(companyId, {
      ...rating.ratings,
      rating_source: "agent",
      rating_rationale: rating.rationale,
      rating_model: model,
      rated_by: AGENT_NAME,
      rated_at: ratedAt,
      ...rescore(ratings),
    });
    return true;
  });
}

/** Ratings from the bundled demo file for the companies it covers; returns how many. */
export function applyBundledRatings(file: BundledRatings = bundled as BundledRatings): number {
  let applied = 0;
  for (const [companyId, input] of inputs) {
    const entry = file.ratings[input.key];
    if (!entry || typeof entry.rationale !== "string") continue;
    const ratings = Object.fromEntries(FATHOM_KEYS.map((key) => [key, Number(entry[key])])) as AgentRating["ratings"];
    if (FATHOM_KEYS.some((key) => !Number.isInteger(ratings[key]) || ratings[key] < 1 || ratings[key] > 5)) continue;
    const rating: AgentRating = { key: input.key, ratings, rationale: entry.rationale };
    if (applyAgentRating(companyId, rating, file.model ?? "", file.generated_at ?? new Date().toISOString())) applied += 1;
  }
  return applied;
}

/** Companies from the latest run that are still in the CRM and nobody has rated. */
export function unratedInputs(): [number, AgentInput][] {
  return [...inputs].filter(([companyId]) => repo.getCompany(companyId)?.rating_source === "");
}

// ── the live run ──────────────────────────────────────────────────────────────────

export interface AgentStatus {
  state: "idle" | "running" | "done" | "error";
  done: number;
  total: number;
  error: string | null;
}

let status: AgentStatus = { state: "idle", done: 0, total: 0, error: null };
let run = 0;
const listeners = new Set<() => void>();

function setStatus(next: AgentStatus): void {
  status = next;
  for (const listener of listeners) listener();
}

export function agentStatus(): AgentStatus {
  return status;
}

export function subscribeAgentStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function rateBatch(batch: [number, AgentInput][]): Promise<{ ratings: AgentRating[]; model: string }> {
  const response = await fetch("/api/rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companies: batch.map(([, input]) => input) }),
  });
  const body = (await response.json().catch(() => null)) as { ratings?: AgentRating[]; model?: string; error?: string } | null;
  if (!response.ok || !body?.ratings) throw new Error(body?.error ?? `The rating agent answered ${response.status}.`);
  return { ratings: body.ratings, model: body.model ?? "" };
}

/** Rate every unrated company of the latest run, in the background (browser only). */
export async function startAgentRating(): Promise<void> {
  if (typeof window === "undefined" || status.state === "running") return;
  const pending = unratedInputs();
  if (!pending.length) return;
  const mine = ++run;
  const batches: [number, AgentInput][][] = [];
  for (let start = 0; start < pending.length; start += AGENT_BATCH) batches.push(pending.slice(start, start + AGENT_BATCH));
  let done = 0;
  setStatus({ state: "running", done, total: pending.length, error: null });

  async function worker(): Promise<void> {
    while (batches.length && run === mine) {
      const batch = batches.shift()!;
      const { ratings, model } = await rateBatch(batch);
      if (run !== mine) return;
      const ids = new Map(batch.map(([companyId, input]) => [input.key, companyId]));
      const ratedAt = new Date().toISOString();
      for (const rating of ratings) {
        const companyId = ids.get(rating.key);
        if (companyId !== undefined) applyAgentRating(companyId, rating, model, ratedAt);
      }
      done += batch.length;
      setStatus({ state: "running", done, total: pending.length, error: null });
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL_BATCHES, batches.length) }, worker));
    if (run === mine) setStatus({ state: "done", done, total: pending.length, error: null });
  } catch (error) {
    if (run === mine) {
      run += 1; // stop the other workers
      setStatus({ state: "error", done, total: pending.length, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
