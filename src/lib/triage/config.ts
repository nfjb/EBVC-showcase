/**
 * Loads ``config/weights.yaml``, ``config/team.yaml`` and the thesis keywords from
 * ``config/thesis.md``. The files are bundled into the app at build time (``?raw``), so the
 * rules run in the browser; restart the dev server after editing them.
 */

import YAML from "yaml";

import teamText from "../../../config/team.yaml?raw";
import thesisText from "../../../config/thesis.md?raw";
import weightsText from "../../../config/weights.yaml?raw";

import { parseIsoDate, type IsoDate } from "./dates";
import { pyStrip } from "./py";

export interface TriageConfig {
  demo_today: IsoDate;
  weights: Record<string, number>;
  source_quality: Record<string, number>;
  momentum_cap: number;
  hard_filters: HardFilterRules;
  queue_flags: { decide_this_week_days: number; decision_required_days: number };
  intro_reply_working_days: number;
  suggested_merge_similarity: number;
  worklist_size: number;
  urgency: {
    base: number;
    intro_overdue: number;
    intro_due_today: number;
    intro_reminder: number;
    intro_open: number;
    recent_signal_days: number;
    recent_signal_bonus: number;
    signal_days: number;
    signal_bonus: number;
  };
  cockpit: { new_startup_days: number; long_tracking_days: number };
  matrix: { score_split: number; urgency_split: number };
}

export interface HardFilterRules {
  stages: string[];
  countries: Record<string, string[]>;
  implied_ticket_share: number;
  ticket_min_eur: number;
  ticket_max_eur: number;
}

export interface TeamMember {
  name: string;
  role: string;
  office: string;
  responsible_partner: string;
}

export type ThesisKeywords = Record<"strong" | "partial" | "outside", string[]>;

function parseYaml(text: string): unknown {
  // YAML 1.1, as PyYAML reads it: an unquoted 2026-09-30 is a date.
  return YAML.parse(text, { version: "1.1" });
}

let triageConfig: TriageConfig | null = null;
let thesisKeywords: ThesisKeywords | null = null;
let team: TeamMember[] | null = null;

export function loadTriageConfig(): TriageConfig {
  if (triageConfig === null) {
    const raw = parseYaml(weightsText) as Record<string, unknown>;
    const today = raw.demo_today;
    const demoToday =
      today instanceof Date ? today.toISOString().slice(0, 10) : parseIsoDate(String(today));
    triageConfig = { ...(raw as unknown as TriageConfig), demo_today: demoToday };
  }
  return triageConfig;
}

/** The demo's fixed "today" (config/weights.yaml → demo_today). */
export function demoToday(): IsoDate {
  return loadTriageConfig().demo_today;
}

/** The ``strong`` / ``partial`` / ``outside`` keyword lists from thesis.md. */
export function loadThesisKeywords(): ThesisKeywords {
  if (thesisKeywords === null) {
    const text = thesisText;
    const keywords = {} as ThesisKeywords;
    for (const level of ["strong", "partial", "outside"] as const) {
      const match = new RegExp(`^\\s*${level}:\\s*(.+)$`, "m").exec(text);
      const words = match ? match[1].split(",") : [];
      keywords[level] = words.map((word) => pyStrip(word).toLowerCase()).filter((word) => word);
    }
    thesisKeywords = keywords;
  }
  return thesisKeywords;
}

export function loadTeam(): TeamMember[] {
  if (team === null) {
    team = (parseYaml(teamText) as { team: TeamMember[] }).team;
  }
  return team;
}

/** Team member names in config order — the people a click can be logged under. */
export function teamNames(): string[] {
  return loadTeam().map((member) => member.name);
}

/** Who a warm intro escalates to on day 3, per team member. */
export function responsiblePartners(): Record<string, string> {
  return Object.fromEntries(loadTeam().map((member) => [member.name, member.responsible_partner]));
}

export function teamRoles(): Record<string, string> {
  return Object.fromEntries(loadTeam().map((member) => [member.name, member.role]));
}
