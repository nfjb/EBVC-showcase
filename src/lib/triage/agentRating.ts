/**
 * The Fathom rating agent: an AI model rates every company on the ten Fathom dimensions (1–5) and
 * justifies the result in three sentences. This module is the pure part — what the agent
 * is told, the JSON it must answer in, and the checks on that answer. The calls happen in
 * ``src/app/api/rate/route.ts``, for companies the bundled demo ratings do not cover.
 *
 * The agent sees company-level information only: deck text, one-liner, stage, round,
 * channels and the enrichment signals. No founder names, email addresses, LinkedIn profiles
 * or introducer names are sent. A person's own ratings always win: the agent never
 * overwrites them (``src/lib/crm/agent.ts``).
 */

import type { CsvRow } from "./csv";
import { INTRODUCER_LABELS, CHANNEL_LABELS, label } from "./labels";
import type { CompanyFields, TouchpointFields } from "./pipeline";
import { FATHOM_DIMENSIONS, FATHOM_KEYS, type FathomDimension } from "./scoring";

export const AGENT_BATCH = 20;
const MAX_TEXT = 1200;
const MAX_LIST = 20;

/** Everything the agent knows about one company. ``key`` matches it across uploads. */
export interface AgentInput {
  key: string;
  company: string;
  one_liner: string;
  deck_texts: string[];
  stage: string;
  country: string;
  round_size_eur: number | null;
  first_seen_at: string | null;
  touchpoints: number;
  channels: string[];
  warm_intros_from: string[];
  signals: { type: string; date: string; description: string }[];
}

/** The agent's answer for one company. */
export interface AgentRating {
  key: string;
  ratings: Record<FathomDimension, number>;
  rationale: string;
}

/** A stable key for a company across uploads: its website, else its name. */
export function companyKey(fields: Pick<CompanyFields, "website_domain" | "name">): string {
  return fields.website_domain ? `domain:${fields.website_domain}` : `name:${fields.name.trim().toLowerCase()}`;
}

/** The agent's input for one planned company (fields, records and known signals). */
export function agentInput(fields: CompanyFields, touchpoints: TouchpointFields[], signals: CsvRow[]): AgentInput {
  const unique = (values: string[]) => [...new Set(values.filter((value) => value))];
  return {
    key: companyKey(fields),
    company: fields.name,
    one_liner: fields.one_liner,
    deck_texts: unique(touchpoints.map((touchpoint) => touchpoint.deck_text)),
    stage: fields.stage,
    country: fields.country,
    round_size_eur: fields.round_size_eur,
    first_seen_at: fields.first_seen_at,
    touchpoints: touchpoints.length,
    channels: unique(touchpoints.map((touchpoint) => label(CHANNEL_LABELS, touchpoint.channel))),
    warm_intros_from: touchpoints
      .filter((touchpoint) => touchpoint.channel === "warm_intro")
      .map((touchpoint) => label(INTRODUCER_LABELS, touchpoint.introducer_type)),
    signals: signals.map((signal) => ({
      type: signal.signal_type,
      date: signal.event_date,
      description: signal.description,
    })),
  };
}

const DIMENSION_GUIDE = FATHOM_DIMENSIONS.map((dimension) => `- ${dimension.key} (${dimension.label}): ${dimension.assesses}`).join(
  "\n",
);

export const AGENT_INSTRUCTIONS = `You are the Fathom rating agent of Skarv Ventures, a Pre-Seed/Seed fund for the Nordics and DACH.
Rate each company on the ten Fathom investment criteria, each a whole number from 1 (weak) to 5 (strong):
${DIMENSION_GUIDE}
Rules:
- Use only the information given. Where there is little or no evidence for a dimension, rate it 2 or 3 and say the evidence is thin; never assume facts.
- Rate the team on evidence about the team in the deck and the signals (roles, relevant experience, senior hires, execution). Never on anyone's name, gender, age, nationality or background.
- The rationale is exactly three sentences in British English: the overall picture and why the deal ranks where it does; the strongest dimensions with their evidence; the weakest dimensions and the evidence that is missing.
- Neutral and concise. No marketing language, no emoji.
Return one rating for every company key you were given.`;

export const AGENT_SCHEMA = {
  type: "object",
  properties: {
    ratings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          ...Object.fromEntries(FATHOM_KEYS.map((key) => [key, { type: "integer", minimum: 1, maximum: 5 }])),
          rationale: { type: "string" },
        },
        required: ["key", ...FATHOM_KEYS, "rationale"],
        additionalProperties: false,
      },
    },
  },
  required: ["ratings"],
  additionalProperties: false,
} as const;

/** The Responses API request body for a batch of companies. */
export function agentRequest(model: string, inputs: AgentInput[]): Record<string, unknown> {
  return {
    model,
    instructions: AGENT_INSTRUCTIONS,
    input: [{ role: "user", content: `Companies to rate (JSON):\n${JSON.stringify(inputs)}` }],
    text: { format: { type: "json_schema", name: "fathom_ratings", schema: AGENT_SCHEMA, strict: true } },
  };
}

function text(value: unknown, max = MAX_TEXT): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function texts(value: unknown, max = MAX_TEXT): string[] {
  return Array.isArray(value) ? value.slice(0, MAX_LIST).map((item) => text(item, max)) : [];
}

/** Rebuild the inputs from a request body: known fields only, bounded lengths. */
export function cleanAgentInputs(body: unknown): AgentInput[] {
  const raw = (body as { companies?: unknown } | null)?.companies;
  if (!Array.isArray(raw) || !raw.length || raw.length > AGENT_BATCH) {
    throw new Error(`Send between 1 and ${AGENT_BATCH} companies.`);
  }
  return raw.map((item) => {
    const input = (item ?? {}) as Record<string, unknown>;
    return {
      key: text(input.key, 200),
      company: text(input.company, 120),
      one_liner: text(input.one_liner),
      deck_texts: texts(input.deck_texts),
      stage: text(input.stage, 40),
      country: text(input.country, 10),
      round_size_eur: typeof input.round_size_eur === "number" ? input.round_size_eur : null,
      first_seen_at: typeof input.first_seen_at === "string" ? input.first_seen_at.slice(0, 10) : null,
      touchpoints: typeof input.touchpoints === "number" ? input.touchpoints : 0,
      channels: texts(input.channels, 40),
      warm_intros_from: texts(input.warm_intros_from, 40),
      signals: (Array.isArray(input.signals) ? input.signals.slice(0, MAX_LIST) : []).map((signal) => {
        const entry = (signal ?? {}) as Record<string, unknown>;
        return { type: text(entry.type, 40), date: text(entry.date, 10), description: text(entry.description, 300) };
      }),
    };
  });
}

/**
 * Check the agent's JSON: one rating per requested key, every dimension a whole number 1–5,
 * and a non-empty rationale. Anything else for a company is dropped, so it stays unrated.
 */
export function parseAgentRatings(textOut: string, keys: string[]): AgentRating[] {
  const parsed = JSON.parse(textOut) as { ratings?: unknown };
  const wanted = new Set(keys);
  const found = new Map<string, AgentRating>();
  for (const item of Array.isArray(parsed.ratings) ? parsed.ratings : []) {
    const entry = item as Record<string, unknown>;
    const key = text(entry.key, 200);
    const rationale = text(entry.rationale).trim();
    if (!wanted.has(key) || !rationale) continue;
    const ratings = {} as Record<FathomDimension, number>;
    let valid = true;
    for (const dimension of FATHOM_KEYS) {
      const value = entry[dimension];
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) valid = false;
      else ratings[dimension] = value;
    }
    if (valid) found.set(key, { key, ratings, rationale });
  }
  return keys.flatMap((key) => {
    const rating = found.get(key);
    return rating ? [rating] : [];
  });
}
