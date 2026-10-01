"use client";

/** The Audit log table and the Outbox list, each with its multi-select filters. */

import { useState } from "react";

function MultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
  format = (value) => value,
}: {
  label: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  format?: (value: string) => string;
}) {
  const summary = selected.length ? selected.map(format).join(", ") : placeholder;
  return (
    <div className="field">
      <span>{label}</span>
      <details className="multiselect">
        <summary aria-label={`${label}: ${summary}`}>{summary}</summary>
        <div className="menu-panel">
          {options.map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) =>
                  onChange(
                    event.target.checked ? [...selected, option] : selected.filter((value) => value !== option),
                  )
                }
              />
              {format(option)}
            </label>
          ))}
          {selected.length ? (
            <button type="button" className="button small" onClick={() => onChange([])}>
              Clear
            </button>
          ) : null}
        </div>
      </details>
    </div>
  );
}

export interface AuditRow {
  id: number;
  when: string;
  who: string;
  company: string;
  decision: string;
  passReason: string;
  comment: string;
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [people, setPeople] = useState<string[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const sortedUnique = (values: string[]) => [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const shown = rows.filter(
    (row) => (!people.length || people.includes(row.who)) && (!kinds.length || kinds.includes(row.decision)),
  );
  return (
    <>
      <div className="grid-2">
        <MultiSelect
          label="Who"
          placeholder="Everyone"
          options={sortedUnique(rows.map((row) => row.who))}
          selected={people}
          onChange={setPeople}
        />
        <MultiSelect
          label="Decision"
          placeholder="All decisions"
          options={sortedUnique(rows.map((row) => row.decision))}
          selected={kinds}
          onChange={setKinds}
        />
      </div>
      <div className="table-wrap tall">
        <table className="data">
          <thead>
            <tr>
              <th>When (UTC)</th>
              <th>Who</th>
              <th>Company</th>
              <th>Decision</th>
              <th>Pass reason</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                <td style={{ whiteSpace: "nowrap" }}>{row.when}</td>
                <td>{row.who}</td>
                <td>{row.company}</td>
                <td>{row.decision}</td>
                <td>{row.passReason}</td>
                <td>{row.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export interface OutboxItem {
  id: number;
  kind: string;
  label: string;
  address: string;
  subject: string;
  body: string;
}

export function OutboxList({ items, kindLabels }: { items: OutboxItem[]; kindLabels: Record<string, string> }) {
  const [kinds, setKinds] = useState<string[]>([]);
  return (
    <>
      <div style={{ maxWidth: 320 }}>
        <MultiSelect
          label="Type"
          placeholder="All types"
          options={Object.keys(kindLabels)}
          selected={kinds}
          onChange={setKinds}
          format={(kind) => kindLabels[kind] ?? kind}
        />
      </div>
      {items
        .filter((item) => !kinds.length || kinds.includes(item.kind))
        .map((item) => (
          <details key={item.id} className="expander">
            <summary>{item.label}</summary>
            <div className="expander-body">
              <p className="caption">
                To: {item.address} · Subject: {item.subject}
              </p>
              <pre>{item.body}</pre>
            </div>
          </details>
        ))}
    </>
  );
}
