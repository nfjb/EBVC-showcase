/**
 * Pre-rate the bundled demo companies on the Fathom criteria, without any API call, and save
 * the ratings to demo/fathom_ratings.json:
 *
 *     npm run demo:prerate
 *
 * This is the assessment Claude made of the demo data, written down as a reviewable rubric so
 * it can be rerun when the demo files change. The demo deck texts are one templated sentence
 * per sector, so each company starts from the sector's assessment; its enrichment signals
 * (hires, traction, an announced round) then move the dimensions they are evidence for.
 * Where there is no evidence the rating stays cautious (2), and the rationale says so.
 *
 * The live OpenAI agent (/api/rate) is only for companies this file does not cover.
 */

import fs from "node:fs";
import path from "node:path";

import { agentInput, type AgentInput } from "../src/lib/triage/agentRating";
import { loadTriageConfig } from "../src/lib/triage/config";
import { planPipeline } from "../src/lib/triage/pipeline";
import { pyFixed } from "../src/lib/triage/py";
import { FATHOM_DIMENSIONS, scoreBand, scoreCompany, type FathomDimension } from "../src/lib/triage/scoring";

const DEMO = path.resolve(import.meta.dirname, "..", "demo");
const OUTPUT = path.join(DEMO, "fathom_ratings.json");
export const PRE_RATED_BY = "claude-opus-5-5, pre-rated demo data";

type Ratings = Record<FathomDimension, number>;

interface Sector {
  /** How the deck text reads, as a clause: "warehouse robotics with machine vision". */
  what: string;
  ratings: Ratings;
  /** Why the sector's strong dimensions are strong (clauses). */
  strengths: Partial<Record<FathomDimension, string>>;
  /** What the deck leaves open for the weak dimensions (noun phrases). */
  gaps: Partial<Record<FathomDimension, string>>;
}

const BASE_GAPS: Record<FathomDimension, string> = {
  team: "the founders' track record or roles",
  market: "a bottom-up market size",
  problem_solution_fit: "a quantified customer pain",
  technology_product: "product maturity or IP",
  business_model: "pricing or unit economics",
  traction_validation: "users, revenue or pilots",
  competition: "a view of competitors or a moat",
  go_to_market: "an ideal customer profile or sales channels",
  financials: "a use of funds tied to milestones",
  exit_potential: "named strategic buyers",
};

function r(values: number[]): Ratings {
  return Object.fromEntries(FATHOM_DIMENSIONS.map((dimension, index) => [dimension.key, values[index]])) as Ratings;
}

// Order: team, market, problem–solution, technology, business model, traction,
// competition, go-to-market, financials, exit.
const SECTORS: { match: RegExp; sector: Sector }[] = [
  {
    match: /robot/i,
    sector: {
      what: "warehouse robotics with machine vision for mid-size factories",
      ratings: r([2, 4, 3, 3, 2, 2, 3, 2, 2, 4]),
      strengths: {
        market: "labour shortages keep warehouse automation growing",
        exit_potential: "automation and logistics groups actively buy robotics start-ups",
        competition: "mid-size factories are a niche the large integrators under-serve",
        problem_solution_fit: "manual picking is a clear, costly pain",
        technology_product: "machine vision plus hardware is hard to copy",
      },
      gaps: { business_model: "hardware economics (sale, lease or robots-as-a-service)" },
    },
  },
  {
    match: /grid|energy|battery/i,
    sector: {
      what: "software that forecasts grid load and schedules battery storage",
      ratings: r([2, 4, 3, 3, 3, 2, 3, 2, 2, 3]),
      strengths: {
        market: "the energy transition is pushing grid flexibility up every utility's agenda",
        problem_solution_fit: "forecasting and storage scheduling address a concrete grid cost",
        technology_product: "forecasting models improve with every site's data",
        business_model: "software licences can recur",
        competition: "data from deployed sites can become a moat",
        exit_potential: "utilities and energy-tech groups buy grid software",
      },
      gaps: {},
    },
  },
  {
    match: /workflow|saas|construction/i,
    sector: {
      what: "B2B SaaS that digitises site workflow and supply-chain paperwork",
      ratings: r([2, 3, 3, 2, 3, 2, 2, 2, 2, 3]),
      strengths: {
        market: "construction and manufacturing are still paper-heavy",
        problem_solution_fit: "paperwork on sites is a recurring, visible pain",
        business_model: "subscription SaaS is easy to understand and recurring",
        exit_potential: "construction-software platforms consolidate actively",
      },
      gaps: { competition: "how it stands apart in a crowded workflow-software field" },
    },
  },
  {
    match: /payment/i,
    sector: {
      what: "an API for instant payment acceptance and automatic invoice reconciliation",
      ratings: r([2, 4, 3, 3, 3, 2, 2, 2, 2, 3]),
      strengths: {
        market: "instant payments are becoming the default across Europe",
        problem_solution_fit: "manual reconciliation is a concrete merchant pain",
        technology_product: "an API product scales without services",
        business_model: "transaction fees grow with merchant volume",
        exit_potential: "payment groups buy infrastructure to fill product gaps",
      },
      gaps: { competition: "differentiation against incumbent payment providers" },
    },
  },
  {
    match: /monitor|clinic|patient/i,
    sector: {
      what: "a platform for clinics to monitor patients remotely and triage appointments",
      ratings: r([2, 3, 3, 2, 2, 2, 2, 2, 2, 3]),
      strengths: {
        market: "clinics face rising demand with flat staffing",
        problem_solution_fit: "triage and remote monitoring target a clear clinical workload",
        exit_potential: "health-IT groups buy proven clinical tools",
      },
      gaps: {
        business_model: "who pays and whether reimbursement covers it",
        go_to_market: "a route through long healthcare sales cycles",
        technology_product: "regulatory readiness and product maturity",
      },
    },
  },
  {
    match: /consumer|commut/i,
    sector: {
      what: "a consumer app rewarding commuters for greener travel",
      ratings: r([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]),
      strengths: {},
      gaps: {
        business_model: "how rewards are paid for and who pays",
        market: "evidence that commuters change habits for rewards",
        problem_solution_fit: "an urgent user pain rather than a nice-to-have",
      },
    },
  },
  {
    match: /gam/i,
    sector: {
      what: "a casual mobile-games studio with live-ops and in-app purchases",
      ratings: r([2, 3, 2, 2, 3, 2, 1, 2, 2, 2]),
      strengths: {
        business_model: "in-app purchases are a proven revenue model",
        market: "casual mobile gaming is large, if hit-driven",
      },
      gaps: {
        competition: "how it wins in one of the most crowded app categories",
        problem_solution_fit: "what makes the games stand out",
      },
    },
  },
];

const NOTE_LABELS: Record<FathomDimension, string> = Object.fromEntries(
  FATHOM_DIMENSIONS.map((dimension) => [dimension.key, dimension.label.toLowerCase()]),
) as Record<FathomDimension, string>;

function sectorOf(input: AgentInput): Sector {
  const text = `${input.one_liner} ${input.deck_texts.join(" ")}`;
  const found = SECTORS.find((candidate) => candidate.match.test(text));
  if (!found) throw new Error(`No sector rubric for ${input.company}: ${input.one_liner}`);
  return found.sector;
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The rating and three-sentence rationale for one company. */
export function preRate(input: AgentInput): { ratings: Ratings; rationale: string } {
  const sector = sectorOf(input);
  const ratings = { ...sector.ratings };
  const evidence: Partial<Record<FathomDimension, string[]>> = {};
  const raise = (dimension: FathomDimension, to: number, why: string) => {
    ratings[dimension] = Math.min(5, Math.max(ratings[dimension], to));
    (evidence[dimension] ??= []).push(why);
  };
  const plus = (dimension: FathomDimension, why: string) => raise(dimension, ratings[dimension] + 1, why);

  const mentions: string[] = [];
  for (const signal of input.signals) {
    const text = signal.description;
    if (signal.type === "senior_hire") {
      plus("team", text.replace(/^Hired /, "the hire of "));
      if (/sales/i.test(text)) plus("go_to_market", "a Head of Sales on board");
      if (/engineering/i.test(text)) plus("technology_product", "senior engineering leadership");
      if (/CFO/.test(text)) plus("financials", "a CFO on board");
    } else if (signal.type === "traction_update") {
      if (/ARR/.test(text)) {
        raise("traction_validation", 4, text.replace(/^Passed /, "passing "));
        plus("business_model", "recurring revenue proving willingness to pay");
      } else if (/doubled/i.test(text)) {
        raise("traction_validation", 4, "doubling paying customers since spring");
        plus("business_model", "paying customers");
      } else if (/enterprise/i.test(text)) {
        raise("traction_validation", 3, "a first enterprise customer");
        plus("go_to_market", "a first enterprise sale");
      } else if (/pilot/i.test(text)) {
        raise("traction_validation", 3, text.replace(/^Signed /, "").replace(/^a /, "a "));
        plus("problem_solution_fit", "customers willing to pilot it");
      }
    } else if (signal.type === "round_announced") {
      plus("financials", text.replace(/^Announced /, "an announced ").replace(/ round/, " round"));
    } else if (signal.type === "news") {
      mentions.push(text.charAt(0).toLowerCase() + text.slice(1));
    }
  }

  const fathom = loadTriageConfig().fathom;
  const [score] = scoreCompany({ ...ratings, storytelling_bonus: null }, fathom);
  const band = scoreBand(score, FATHOM_DIMENSIONS.length, fathom);

  // 1. Overall picture.
  const proof = input.signals.filter((signal) => signal.type !== "news").length;
  const overall =
    `${input.company} scores ${pyFixed(score, 1)} % (${band.toLowerCase()}): ${sector.what}, ` +
    (proof
      ? `with outside evidence beyond the deck${mentions.length ? ` and press attention (${list(mentions)})` : ""}.`
      : mentions.length
        ? `with press attention (${list(mentions)}) but no proof of traction or team yet.`
        : "but the deck alone gives no proof of traction or team yet.");

  // 2. Strongest dimensions, with their evidence.
  const ranked = FATHOM_DIMENSIONS.map((dimension) => dimension.key)
    .filter((key) => ratings[key] >= 3)
    .sort((a, b) => ratings[b] - ratings[a] || fathom.weights[b] - fathom.weights[a])
    .slice(0, 3);
  const strengths = ranked.map((key) => {
    const why = evidence[key]?.length ? list(evidence[key]!) : sector.strengths[key];
    return `${NOTE_LABELS[key]} (${ratings[key]}${why ? `: ${why}` : ""})`;
  });
  const strongest = strengths.length
    ? `Strongest are ${list(strengths)}.`
    : "No dimension stands out yet; every rating rests on a one-line deck.";

  // 3. Weakest dimensions and the missing evidence.
  const weakest = FATHOM_DIMENSIONS.map((dimension) => dimension.key)
    .filter((key) => ratings[key] <= 2)
    .sort((a, b) => ratings[a] - ratings[b] || fathom.weights[b] - fathom.weights[a])
    .slice(0, 4);
  const missing = weakest.map((key) => sector.gaps[key] ?? BASE_GAPS[key]);
  const gaps = weakest.length
    ? `Weakest are ${list(weakest.map((key) => NOTE_LABELS[key]))}; the deck does not show ${missing.join("; ")}.`
    : "No dimension is weak; the next step is to verify the evidence in a first call.";

  return { ratings, rationale: `${overall} ${strongest} ${gaps}` };
}

function main(): void {
  const plan = planPipeline(
    fs.readFileSync(path.join(DEMO, "inbound_records.csv"), "utf-8"),
    fs.readFileSync(path.join(DEMO, "signals.csv"), "utf-8"),
    loadTriageConfig(),
  );
  const ratings: Record<string, Record<string, unknown>> = {};
  for (const { fields, touchpoints, signals } of plan.companies) {
    const input = agentInput(fields, touchpoints, signals);
    const { ratings: values, rationale } = preRate(input);
    ratings[input.key] = { ...values, rationale };
  }
  const sorted = Object.fromEntries(Object.entries(ratings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  fs.writeFileSync(
    OUTPUT,
    `${JSON.stringify({ model: PRE_RATED_BY, generated_at: "2026-10-01T09:30:00Z", ratings: sorted }, null, 2)}\n`,
  );
  console.log(`Pre-rated ${Object.keys(sorted).length} demo companies into ${OUTPUT}`);
}

if (process.argv[1]?.endsWith("prerate-demo.ts")) main();
