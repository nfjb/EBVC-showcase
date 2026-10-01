import fs from "node:fs";
import path from "node:path";

import { getStore, openDatabase, type Row, type TableName, useDatabase } from "@/lib/db/connection";
import { getCompany } from "@/lib/db/repository";
import { runPipeline, type PipelineCounts } from "@/lib/crm/pipeline";
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
  useDatabase(openDatabase());
}

/** A fresh CRM loaded from the generated demo files. */
export function loadDemo(): PipelineCounts {
  freshDatabase();
  return runPipeline(...demoTexts());
}

/** Rows in ``table`` (matching ``where``, if given). */
export function count(table: TableName, where: (row: Row) => boolean = () => true): number {
  return getStore()[table].filter(where).length;
}

export function getCompanyOrThrow(id: number): Company {
  const company = getCompany(id);
  if (!company) throw new Error(`company ${id} not found`);
  return company;
}

export function robotix(): Company {
  const row = getStore().company.find((company) => company.website_domain === "robotix.example")!;
  return getCompanyOrThrow(Number(row.id));
}
