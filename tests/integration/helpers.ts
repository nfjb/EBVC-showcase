import fs from "node:fs";
import path from "node:path";

import { getDb, openDatabase, useDatabase } from "@/lib/db/connection";
import { getCompany } from "@/lib/db/repository";
import { runPipeline, type PipelineCounts } from "@/lib/server/pipeline";
import type { Company } from "@/lib/triage/types";

const DEMO = path.resolve(process.cwd(), "demo");

export function demoTexts(): [string, string] {
  return [
    fs.readFileSync(path.join(DEMO, "inbound_records.csv"), "utf-8"),
    fs.readFileSync(path.join(DEMO, "signals.csv"), "utf-8"),
  ];
}

/** A fresh, empty CRM for one test. */
export function freshDatabase(): void {
  useDatabase(openDatabase(":memory:"));
}

/** A fresh CRM loaded from the generated demo files. */
export function loadDemo(): PipelineCounts {
  freshDatabase();
  return runPipeline(...demoTexts());
}

export function count(sql: string, ...params: unknown[]): number {
  return (getDb().prepare(sql).get(...params) as { n: number }).n;
}

export function getCompanyOrThrow(id: number): Company {
  const company = getCompany(id);
  if (!company) throw new Error(`company ${id} not found`);
  return company;
}

export function robotix(): Company {
  const row = getDb().prepare("SELECT id FROM company WHERE website_domain = 'robotix.example'").get() as {
    id: number;
  };
  return getCompanyOrThrow(row.id);
}
