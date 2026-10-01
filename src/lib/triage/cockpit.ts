/**
 * The Monday cockpit and the priority matrix: which deals each view and quick filter shows,
 * who owns the next step, and where each deal sits on score % × urgency.
 */

import { loadTriageConfig, responsiblePartners, teamRoles } from "./config";
import { pyGet } from "./py";
import type { CompanyWithTouchpoints } from "./types";
import { QUADRANTS, quadrant, rankByPriority, type CockpitLine, type QuadrantKey } from "./urgency";
import { ESCALATED } from "./workingDays";

export type Line = CockpitLine<CompanyWithTouchpoints>;

export const VIEWS = ["My view", "Team view", "Pipeline", "Hot topics"] as const;
export type View = (typeof VIEWS)[number];

export const TILES = {
  top: "My top 20",
  new: "Unreviewed new startups",
  intros: "Warm intros due",
  drafts: "Drafts to approve",
  tracking: "Tracking > 3 months",
} as const;
export type TileKey = keyof typeof TILES;

export function tileFilters<L extends CockpitLine>(lines: L[]): Record<TileKey, L[]> {
  const config = loadTriageConfig();
  const newDays = config.cockpit.new_startup_days;
  const trackingDays = config.cockpit.long_tracking_days;
  const openPassing = lines.filter((line) => line.company.status === "open" && line.company.passed_hard_filters);
  return {
    top: rankByPriority(openPassing).slice(0, config.worklist_size),
    new: rankByPriority(
      openPassing.filter(
        (line) => line.days_in_queue <= newDays && line.tasks.includes("Rate thesis, market and team"),
      ),
    ),
    intros: rankByPriority(lines.filter((line) => line.intro_state !== null)),
    drafts: rankByPriority(lines.filter((line) => line.tasks.includes("Approve pass draft"))),
    tracking: rankByPriority(openPassing.filter((line) => line.days_in_queue > trackingDays)),
  };
}

export function tileLabel(tile: TileKey, view: View): string {
  if (tile === "top") return view === "My view" ? "My top 20" : "Team top 20";
  return TILES[tile];
}

export interface AssigneeParts {
  owner: string;
  role: string;
  step: string;
  hot: boolean;
}

/** Who owns the next step, what it is, and who it has escalated to — for chasing, not acting. */
export function assigneeParts(line: CockpitLine & { company: { owner: string } }): AssigneeParts {
  const owner = line.company.owner || "Unassigned";
  const role = pyGet(teamRoles(), owner, "");
  let step = line.next_action;
  if (line.intro_state && line.intro_state.past_deadline) step = `⚠ ${step}`;
  if (line.intro_state && line.intro_state.escalation === ESCALATED) {
    const partner = pyGet(responsiblePartners(), owner, owner);
    if (partner !== owner) step += ` · escalated to ${partner}`;
  }
  return { owner, role, step, hot: line.urgent };
}

/** Python ``str.capitalize()``. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

// ── priority matrix ───────────────────────────────────────────────────────────────

export const QUADRANT_ORDER: QuadrantKey[] = ["act_now", "plan", "reply_fast", "park"];

/** A small, fixed offset per company so points on the same value stay visible. */
export function spread(companyId: number, salt: number, width: number): number {
  // Python's % is a floor modulo; ids are positive, so JavaScript's % agrees.
  return (((companyId * salt) % 11) - 5) / 5 * width;
}

export interface MatrixRow {
  company_id: number;
  Company: string;
  "Score %": number;
  Urgency: number;
  x: number;
  y: number;
  Touchpoints: number;
  Source: "Warm intro" | "Cold inbound";
  Quadrant: string;
  quadrant_key: QuadrantKey;
  "Next action": string;
  Owner: string;
  Priority: number;
}

export function matrixRows(lines: Line[]): MatrixRow[] {
  return lines.map((line) => {
    const company = line.company;
    const warm = company.touchpoints.some((touchpoint) => touchpoint.channel === "warm_intro");
    const key = quadrant(line.score_percent, line.urgency);
    return {
      company_id: company.id,
      Company: company.name,
      "Score %": line.score_percent,
      Urgency: line.urgency,
      x: line.score_percent + spread(company.id, 37, 1.6),
      y: line.urgency + spread(company.id, 53, 2.4),
      Touchpoints: company.touchpoint_count,
      Source: warm ? "Warm intro" : "Cold inbound",
      Quadrant: QUADRANTS[key][0],
      quadrant_key: key,
      "Next action": line.next_action,
      Owner: company.owner,
      Priority: line.priority,
    };
  });
}

/** ``sort_values(["Priority", "Score %"], ascending=False)`` — stable for equal keys. */
export function byPriorityThenScore(rows: MatrixRow[]): MatrixRow[] {
  return [...rows].sort((a, b) => b.Priority - a.Priority || b["Score %"] - a["Score %"]);
}

/** ``sort_values("Priority", ascending=False)`` — the list a bubble click opens the deal in. */
export function byPriority(rows: MatrixRow[]): MatrixRow[] {
  return [...rows].sort((a, b) => b.Priority - a.Priority);
}
