"use client";

/**
 * An explanation that opens on hover with a mouse and on tap or Enter everywhere else (a
 * shadcn Popover). Tooltips only open on hover, so on phones and tablets they never would.
 */

import { useRef, useState, type ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function ScoreHint({
  label,
  trigger,
  children,
  className,
  contentClassName,
  side = "left",
}: {
  /** What a screen reader announces for the trigger. */
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const [open, setOpen] = useState(false);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hold = () => {
    if (closing.current) clearTimeout(closing.current);
    closing.current = null;
  };
  // A short delay lets the pointer move from the trigger into the panel.
  const closeSoon = () => {
    hold();
    closing.current = setTimeout(() => setOpen(false), 120);
  };
  const mouse = (handler: () => void) => (event: React.PointerEvent) => {
    if (event.pointerType === "mouse") handler();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "cursor-help rounded-sm underline decoration-muted-foreground/40 decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            className,
          )}
          onPointerEnter={mouse(() => {
            hold();
            setOpen(true);
          })}
          onPointerLeave={mouse(closeSoon)}
        >
          {trigger}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        className={cn("w-auto max-w-[calc(100vw-2rem)] p-3 text-xs", contentClassName)}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={mouse(hold)}
        onPointerLeave={mouse(closeSoon)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
