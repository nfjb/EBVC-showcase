"use client";

/** The message a click leaves behind ("Advanced Robotix AI."), as a shadcn (Sonner) toast. */

import { toast } from "sonner";

export function useFlash(): (message: string) => void {
  return (message: string) => toast.success(message);
}
