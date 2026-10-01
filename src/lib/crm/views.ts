/** Data the pages read: cockpit lines, warm intros with their deadlines, sidebar counts. */

import * as repo from "@/lib/db/repository";
import type { Line } from "@/lib/triage/cockpit";
import { demoToday, loadTriageConfig } from "@/lib/triage/config";
import type { IsoDate } from "@/lib/triage/dates";
import type { Company, Touchpoint } from "@/lib/triage/types";
import { buildLine } from "@/lib/triage/urgency";
import { introReplyState, type IntroReplyState } from "@/lib/triage/workingDays";

/** One line per company, with its open tasks, next action and priority. */
export function cockpitLines(today: IsoDate = demoToday()): Line[] {
  const pendingMergeIds = new Set<number>();
  for (const suggestion of repo.listMergeSuggestions("pending")) {
    pendingMergeIds.add(suggestion.company_id);
    pendingMergeIds.add(suggestion.candidate_id);
  }
  const passReplySentIds = repo.companyIdsWithPassReply();
  return repo
    .listCompaniesWithTouchpoints()
    .map((company) => buildLine(company, today, pendingMergeIds, passReplySentIds));
}

export interface IntroWithState {
  intro: Touchpoint;
  company: Company;
  state: IntroReplyState;
}

/** Every warm intro with its reply deadline and escalation step. */
export function introStates(today: IsoDate = demoToday()): IntroWithState[] {
  const replyDays = loadTriageConfig().intro_reply_working_days;
  const companies = new Map(repo.listCompanies().map((company) => [company.id, company]));
  return repo.warmIntros().map((intro) => ({
    intro,
    company: companies.get(intro.company_id)!,
    state: introReplyState(intro.received_at, today, replyDays),
  }));
}

/** Open work per page, shown next to its name in the sidebar. */
export function navigationCounts(): Record<string, number> {
  return {
    "Intro tracker": repo.warmIntros().filter((intro) => intro.intro_status === "open").length,
    "Merge queue": repo.countPendingMergeSuggestions(),
  };
}
