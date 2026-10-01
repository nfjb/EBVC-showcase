/** What the reply dialogs need, built from rows already loaded. */

import type { IntroDialogData, PassDialogData } from "@/components/ReplyDialogs";
import { demoToday } from "@/lib/triage/config";
import { founderFromTouchpoints, introducerThanksDraft, introReplyDraft } from "@/lib/triage/drafts";
import type { CompanyWithTouchpoints, Touchpoint } from "@/lib/triage/types";

export function passDialogData(company: CompanyWithTouchpoints): PassDialogData {
  return {
    companyId: company.id,
    companyName: company.name,
    owner: company.owner,
    founder: founderFromTouchpoints(company.touchpoints),
    passCode: company.pass_code,
  };
}

export function introReplyDialogData(intro: Touchpoint, company: CompanyWithTouchpoints): IntroDialogData {
  return {
    introId: intro.id,
    companyName: company.name,
    introducerName: intro.introducer_name,
    draft: introReplyDraft({
      companyName: company.name,
      founder: founderFromTouchpoints(company.touchpoints),
      introducerName: intro.introducer_name,
      introRecipient: intro.recipient,
      today: demoToday(),
    }),
  };
}

export function introducerThanksDialogData(intro: Touchpoint, company: CompanyWithTouchpoints): IntroDialogData {
  return {
    introId: intro.id,
    companyName: company.name,
    introducerName: intro.introducer_name,
    draft: introducerThanksDraft({
      companyName: company.name,
      companyStatus: company.status,
      introducerName: intro.introducer_name,
      introRecipient: intro.recipient,
    }),
  };
}
