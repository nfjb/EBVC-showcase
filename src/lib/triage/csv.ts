/**
 * CSV in and out.
 *
 * Reading mirrors ``pandas.read_csv(file, dtype=str, keep_default_na=False)``: every value
 * stays a string, empty cells are ``""``, blank lines are skipped and a UTF-8 byte-order
 * mark is ignored.
 */

import Papa from "papaparse";

export type CsvRow = Record<string, string>;

export function readCsv(text: string, required: string[] = [], fileLabel = "CSV"): CsvRow[] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const parsed = Papa.parse<string[]>(source, { delimiter: ",", skipEmptyLines: true });
  const fatal = parsed.errors.find((error) => error.type === "Quotes");
  if (fatal) throw new Error(`${fileLabel}: ${fatal.message} (row ${fatal.row ?? "?"})`);
  const [header, ...rows] = parsed.data;
  if (!header) throw new Error(`${fileLabel}: the file is empty (no columns to parse).`);
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length) throw new Error(`${fileLabel}: missing column(s) ${missing.join(", ")}.`);
  return rows.map((cells) => {
    const row: CsvRow = {};
    header.forEach((column, index) => {
      row[column] = cells[index] ?? "";
    });
    return row;
  });
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** ``DataFrame.to_csv(index=False)``: a header row, then one line per row. */
export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(","));
  return `${lines.join("\n")}\n`;
}
