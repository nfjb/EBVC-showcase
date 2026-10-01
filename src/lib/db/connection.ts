/**
 * The SQLite connection. One per server process (kept on ``globalThis`` so Next.js dev
 * reloads do not open a new one each time); tests swap in their own with {@link useDatabase}.
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import { SCHEMA } from "./schema";

export type Db = Database.Database;

const holder = globalThis as typeof globalThis & { __skarvDb?: Db };

export function databasePath(): string {
  return process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "skarv.sqlite");
}

/** Open (and if needed create) a database with the CRM schema. ``":memory:"`` works too. */
export function openDatabase(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  if (file !== ":memory:") db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export function getDb(): Db {
  if (!holder.__skarvDb) holder.__skarvDb = openDatabase(databasePath());
  return holder.__skarvDb;
}

/** Point every query at ``db`` (tests). */
export function useDatabase(db: Db): void {
  holder.__skarvDb = db;
}

/** Run ``work`` in one transaction: everything or nothing, like Django's ``transaction.atomic``. */
export function atomic<T>(work: () => T): T {
  return getDb().transaction(work)();
}
