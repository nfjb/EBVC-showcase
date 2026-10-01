"use client";

/**
 * Page controls that sit at the right of the top bar, next to the breadcrumb (for example
 * "Deals owned by"). A page renders <HeaderActions>; the bar provides the slot.
 */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const HEADER_ACTIONS_ID = "header-actions";

export function HeaderActionsSlot() {
  return <div id={HEADER_ACTIONS_ID} className="ml-auto flex items-center gap-2" />;
}

export function HeaderActions({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById(HEADER_ACTIONS_ID)), []);
  return slot ? createPortal(children, slot) : null;
}
