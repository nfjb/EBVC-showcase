/**
 * Who is clicking. There is no sign-in in this demo, so the person is the team member chosen
 * in the sidebar ("Acting as"), kept in memory for this tab and logged as "<name> (demo)".
 */

import { teamNames } from "@/lib/triage/config";

const listeners = new Set<() => void>();
let chosen = "";

export function actingMember(): string {
  const team = teamNames();
  return team.includes(chosen) ? chosen : team[0];
}

/** The name every decision is logged under. */
export function actingPerson(): string {
  return `${actingMember()} (demo)`;
}

export function setActingMember(name: string): void {
  if (!teamNames().includes(name) || name === chosen) return;
  chosen = name;
  for (const listener of listeners) listener();
}

export function subscribeActingMember(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
