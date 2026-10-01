"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** A modal dialog (native ``<dialog>``: focus trap, Escape to close). */
export function Dialog({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby={titleId}>
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {open ? <div className="dialog-body">{children}</div> : null}
    </dialog>
  );
}
