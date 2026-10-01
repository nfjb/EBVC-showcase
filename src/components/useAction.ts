"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "@/app/actions";

import { useFlash } from "./Flash";

/**
 * Run a server action from a button: show its refusal inline, or flash its success message
 * and call ``onSuccess`` (for example to close the dialog).
 */
export function useAction() {
  const flash = useFlash();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        flash(result.message);
        onSuccess?.();
      } else {
        setError(result.error);
      }
    });
  }

  return { run, pending, error, clearError: () => setError(null) };
}
