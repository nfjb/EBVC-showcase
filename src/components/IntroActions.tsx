"use client";

import { useRef } from "react";

import { setIntroStatusAction } from "@/app/actions";

import { ErrorLine } from "./ReplyDialogs";
import { useAction } from "./useAction";

/** "⋯" on an intro card: mark it replied outside the app, or close it without a reply. */
export function IntroMoreActions({ introId }: { introId: number }) {
  const { run, pending, error } = useAction();
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => menu.current?.removeAttribute("open");
  return (
    <>
      <details className="menu" ref={menu}>
        <summary className="button" aria-label="More actions" title="More actions">
          ⋯
        </summary>
        <div className="menu-panel">
          <button
            type="button"
            className="button small"
            disabled={pending}
            onClick={() => run(() => setIntroStatusAction(introId, "replied"), close)}
          >
            Replied outside the app
          </button>
          <button
            type="button"
            className="button small"
            disabled={pending}
            onClick={() => run(() => setIntroStatusAction(introId, "closed"), close)}
          >
            Close without reply
          </button>
        </div>
      </details>
      <ErrorLine error={error} />
    </>
  );
}
