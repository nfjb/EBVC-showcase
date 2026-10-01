/**
 * The Fathom criteria explained: for each dimension the signals that raise or lower its
 * rating, and what each point on the 1–5 scale means. Shown on the "How scores work" page;
 * the weights themselves live in config/weights.yaml.
 */

import type { FathomDimension } from "./scoring";

export interface DimensionGuide {
  positive: string[];
  negative: string[];
}

export const DIMENSION_GUIDE: Record<FathomDimension, DimensionGuide> = {
  team: {
    positive: [
      "Founders with complementary skills",
      "Relevant experience in the target market",
      "Founders working full time",
      "Clear roles (CEO, CTO, CPO …)",
      "Early proof of execution",
      "Strong advisors or industry connections",
    ],
    negative: [
      "No clearly defined CEO",
      "No relevant experience",
      "Part-time founders",
      "Heavy reliance on external agencies",
      "No skills in tech, product or sales",
      "No evidence of execution speed",
    ],
  },
  market: {
    positive: [
      "A large or fast-growing market",
      "A clearly segmented target customer",
      "Bottom-up market sizing",
      "Structural trends that favour adoption (why now)",
    ],
    negative: [
      "A market too small or too fragmented",
      "No clear target group",
      "Unrealistic market sizes (a “Google TAM”)",
      "No sign of market trends",
    ],
  },
  problem_solution_fit: {
    positive: [
      "A clearly defined, quantified pain",
      "Customer feedback that shows demand",
      "A solution 10× better, faster or cheaper",
      "A problem that exists independently of the product",
    ],
    negative: [
      "An abstract or unclear problem",
      "A pain that is not urgent or cannot be monetised",
      "A solution that feels generic or like a feature",
      "No direct value for the customer",
    ],
  },
  technology_product: {
    positive: [
      "A live product or demo",
      "A strong technological hypothesis",
      "A clear roadmap",
      "A working architecture",
      "Patents or protectable IP",
    ],
    negative: [
      "Figma mock-ups only, with no working approach",
      "No technical detail",
      "No IP strategy",
      "Heavy dependence on third parties",
      "No path to scale",
    ],
  },
  business_model: {
    positive: [
      "A revenue model that is easy to understand",
      "A clear pricing logic",
      "Recurring revenue (SaaS, subscriptions)",
      "High scalability",
    ],
    negative: [
      "No business model given",
      "Unrealistic unit economics",
      "Complicated monetisation",
      "Unclear willingness to pay",
    ],
  },
  traction_validation: {
    positive: [
      "Real usage data",
      "MRR or first revenue",
      "Clear customer voices",
      "LOIs from relevant partners",
      "Working validation studies",
    ],
    negative: [
      "No traction despite a long build",
      "Declarations of intent only",
      "The hypothesis has not been validated",
      "Poor retention or engagement",
    ],
  },
  competition: {
    positive: [
      "A realistic view of the competition",
      "A strong USP",
      "A technology or data moat",
      "A niche strategy with a clear advantage",
    ],
    negative: [
      "“We have no competition”",
      "Generic differentiation",
      "Competitors could copy it easily",
      "No market positioning",
    ],
  },
  go_to_market: {
    positive: [
      "A clearly defined ideal customer profile",
      "A realistic acquisition logic",
      "Clear channels and first experiments",
      "Early customer conversations",
    ],
    negative: [
      "No clear go-to-market",
      "An ideal customer profile that is too broad",
      "Expensive channels that do not scale",
      "An unclear sales process",
    ],
  },
  financials: {
    positive: [
      "A clear cost structure",
      "A realistic financial plan",
      "A transparent use-of-funds split",
      "Assumptions that can be followed",
    ],
    negative: [
      "No financial plan in the deck",
      "Unrealistic revenue forecasts",
      "An unclear capital need",
      "No link between funds and milestones",
    ],
  },
  exit_potential: {
    positive: [
      "Active strategic buyers in the market",
      "Strong synergies with industry players",
      "Technology or data of high strategic value",
      "A clear position in an emerging category",
    ],
    negative: [
      "No clear exit path",
      "A niche without buyers",
      "Technology without strategic use",
      "A market without M&A activity",
    ],
  },
};

/** What each point on the rating scale means. */
export const SCALE_GUIDE: { value: number; label: string; meaning: string }[] = [
  { value: 1, label: "Weak", meaning: "Clear negative signals; a reason not to invest on its own." },
  { value: 2, label: "Thin", meaning: "Little evidence, or more negative than positive signals." },
  { value: 3, label: "Adequate", meaning: "Plausible, with some evidence; nothing stands out either way." },
  { value: 4, label: "Good", meaning: "Several positive signals, backed by evidence." },
  { value: 5, label: "Strong", meaning: "Clearly above the bar, with strong, verified evidence." },
];
