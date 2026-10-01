import Link from "next/link";

import { Notice, PageTitle } from "@/components/page";

/** Shown wherever there is nothing to list because no deal flow has been uploaded yet. */
export function EmptyCrm({ title = "Deal detail" }: { title?: string }) {
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <Notice tone="info">
        No deals loaded yet. Create a{" "}
        <Link className="underline" href="/uploads">
          Deal flow upload
        </Link>{" "}
        with <code>demo/inbound_records.csv</code> and <code>demo/signals.csv</code> (or use the bundled demo files
        there).
      </Notice>
    </>
  );
}
