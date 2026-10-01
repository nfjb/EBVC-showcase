"use client";

import type { ReactNode } from "react";

import { Dialog as DialogRoot, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** A modal dialog (focus trap, Escape to close). The body only renders while it is open. */
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
  return (
    <DialogRoot open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-h-[calc(100vh-48px)] overflow-y-auto sm:max-w-3xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
        </DialogHeader>
        {open ? <div className="text-sm">{children}</div> : null}
      </DialogContent>
    </DialogRoot>
  );
}
