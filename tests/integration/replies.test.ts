/** Reply drafts and the simulated send (spec §5, §7): consistent, signed, logged, never emailed. */

import { beforeEach, describe, expect, it } from "vitest";

import * as repo from "@/lib/db/repository";
import { runPipeline } from "@/lib/crm/pipeline";
import {
  introducerThanksDraftFor,
  introReplyDraftFor,
  passAndReply,
  passReplyDraftFor,
  sendReply,
} from "@/lib/crm/replies";
import { ActionRefused } from "@/lib/triage/errors";
import type { Touchpoint } from "@/lib/triage/types";

import { count, demoTexts, loadDemo, robotix } from "./helpers";

const PERSON = "Mette Lund";

function robotixIntro(): Touchpoint {
  return repo.touchpointsOf(robotix().id).find((touchpoint) => touchpoint.channel === "warm_intro")!;
}

beforeEach(() => {
  loadDemo();
});

describe("replies", () => {
  it("thanks the introducer in an intro reply, signed by the recipient", () => {
    const intro = robotixIntro();
    const draft = introReplyDraftFor(intro, robotix());
    expect(draft.recipient_name).toBe("Freja Lindqvist");
    expect(draft.body).toContain("Hvidsten Family Office");
    expect(draft.body.trimEnd().endsWith(`${intro.recipient}\nSkarv Ventures`)).toBe(true);
  });

  it("marks the intro replied and logs it when the reply is sent", () => {
    const intro = robotixIntro();
    sendReply(robotix().id, introReplyDraftFor(intro, robotix()), PERSON, intro.id);
    expect(repo.getTouchpoint(intro.id)!.intro_status).toBe("replied");
    const messages = repo.listOutboxMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].kind).toBe("intro_reply");
    expect(messages[0].sent_by).toBe(PERSON);
    expect(count("decision", (row) => row.decision === "message_sent")).toBe(1);
  });

  it("names the reason in a pass reply, signed by the person first contacted", () => {
    const company = robotix();
    const draft = passReplyDraftFor(company, "outside_geography");
    expect(draft.body).toContain("Nordics and DACH");
    expect(draft.body.trimEnd().endsWith(`${company.owner}\nSkarv Ventures`)).toBe(true);
  });

  it("uses the comment as the reason for 'other', and requires one", () => {
    expect(() => passReplyDraftFor(robotix(), "other", " ")).toThrow(ActionRefused);
    expect(passReplyDraftFor(robotix(), "other", "we already back a similar team").body).toContain(
      "we already back a similar team",
    );
  });

  it("records both the decision and the message for pass and reply", () => {
    const company = robotix();
    passAndReply(company.id, "market_too_small", PERSON, "", passReplyDraftFor(company, "market_too_small"));
    const passed = robotix();
    expect(passed.status).toBe("passed");
    expect(passed.pass_code).toBe("market_too_small");
    expect(new Set(repo.listDecisions().map((decision) => decision.decision))).toEqual(new Set(["pass", "message_sent"]));
    expect(repo.listOutboxMessages().map((message) => message.kind)).toEqual(["pass"]);
  });

  it("reports the outcome when thanking the introducer", () => {
    const intro = robotixIntro();
    repo.updateCompany(robotix().id, { status: "advanced" });
    const draft = introducerThanksDraftFor(intro, robotix());
    expect(draft.recipient_name).toBe("Hvidsten Family Office");
    expect(draft.body).toContain("taking it forward");
  });

  it("refuses a reply without a message", () => {
    const draft = { ...passReplyDraftFor(robotix(), "outside_stage"), body: "  " };
    expect(() => sendReply(robotix().id, draft, PERSON)).toThrow(ActionRefused);
  });

  it("rolls back the pass when its reply cannot be sent", () => {
    const company = robotix();
    const draft = { ...passReplyDraftFor(company, "outside_stage"), subject: " " };
    expect(() => passAndReply(company.id, "outside_stage", PERSON, "", draft)).toThrow(ActionRefused);
    expect(robotix().status).toBe("open");
    expect(count("decision")).toBe(0);
  });

  it("keeps the outbox through a re-upload", () => {
    const intro = robotixIntro();
    sendReply(robotix().id, introReplyDraftFor(intro, robotix()), PERSON, intro.id);
    runPipeline(...demoTexts());
    const messages = repo.listOutboxMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].company_id).toBeNull();
    expect(messages[0].company_name).toBe("Robotix AI");
  });
});
