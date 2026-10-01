/**
 * Who is clicking. There is no sign-in in this demo, so the person is the team member chosen
 * in the sidebar ("Acting as"), kept in a cookie and logged as "<name> (demo)".
 */

import { cookies } from "next/headers";

import { teamNames } from "@/lib/triage/config";

export const ACTING_COOKIE = "acting_person";

export async function actingMember(): Promise<string> {
  const chosen = (await cookies()).get(ACTING_COOKIE)?.value ?? "";
  const team = teamNames();
  return team.includes(chosen) ? chosen : team[0];
}

/** The name every decision is logged under. */
export async function actingPerson(): Promise<string> {
  return `${await actingMember()} (demo)`;
}
