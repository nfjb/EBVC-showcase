import { Inbox } from "lucide-react";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";

/** Shown wherever there is nothing to list because no deal flow has been uploaded yet. */
export function EmptyCrm({ title = "Deal detail" }: { title?: string }) {
  return (
    <>
      {title ? <PageHeader title={title} /> : null}
      <EmptyState
        icon={Inbox}
        title="No deals loaded yet"
        action={
          <Button asChild>
            <Link href="/uploads">Go to Deal flow uploads</Link>
          </Button>
        }
      >
        Upload <code>demo/inbound_records.csv</code> and <code>demo/signals.csv</code>, or use the bundled demo files.
      </EmptyState>
    </>
  );
}
