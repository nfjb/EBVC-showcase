import Link from "next/link";

/** Shown wherever there is nothing to list because no deal flow has been uploaded yet. */
export function EmptyCrm({ title = "Deal detail" }: { title?: string }) {
  return (
    <>
      <h1>{title}</h1>
      <div className="alert alert-info">
        No deals loaded yet. Create a <Link href="/uploads">Deal flow upload</Link> with{" "}
        <code>demo/inbound_records.csv</code> and <code>demo/signals.csv</code> (or run <code>npm run demo:load</code>
        ).
      </div>
    </>
  );
}
