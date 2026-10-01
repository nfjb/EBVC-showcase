/**
 * Loads ``config/weights.yaml`` and ``config/team.yaml``. The files are bundled into the app at build time (``?raw``), so the
 * rules run in the browser; restart the dev server after editing them.
 */

import YAML from "yaml";

import teamText from "../../../config/team.yaml?raw";
import weightsText from "../../../config/weights.yaml?raw";

import { parseIsoDate, type IsoDate } from "./dates";

export interface TriageConfig {
  demo_today: IsoDate;
  fathom: FathomRules;
  hard_filters: HardFilterRules;
  queue_flags: { decide_this_week_days: number; decision_required_days: number };
  intro_reply_working_days: number;
  suggested_merge_similarity: number;
  worklist_size: number;
  urgency: UrgencyRules;
  cockpit: { new_startup_days: number; long_tracking_days: number; hot_topic_days: number };
  matrix: { score_split: number; urgency_split: number };
}

/** The Urgency Score's five dimensions, point tables and tiers (config/weights.yaml → urgency). */
export interface UrgencyRules {
  reply_obligation: { overdue: number; due_today: number; reminder: number; open: number; none: number };
  relationship: { warm_intro: number; repeat_contact: number; cold: number };
  /** Points by age of the latest signal, most recent band first. */
  activity: { days: number; points: number }[];
  competitive_pressure_days: number;
  competitive_pressure: Record<string, number>;
  /** Points by days since the founder's latest inbound, most recent band first. */
  momentum: { days: number; points: number }[];
  tiers: { min: number; label: string; action: string }[];
}

/** The Fathom investment criteria: weights in %, bands highest first. */
export interface FathomRules {
  scale_max: number;
  weights: Record<string, number>;
  storytelling_bonus_max: number;
  bands: { min: number; label: string }[];
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

function parseYaml(text: string): unknown {
  // YAML 1.1, as PyYAML reads it: an unquoted 2026-09-30 is a date.
  return YAML.parse(text, { version: "1.1" });
}

let triageConfig: TriageConfig | null = null;
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
