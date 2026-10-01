"use client";

import { Children, useId, useState, type ReactNode } from "react";

/** Tabs over server-rendered panels (one child per label). */
export function Tabs({ labels, children }: { labels: string[]; children: ReactNode }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const panels = Children.toArray(children);
  return (
    <div className="tabs">
      <div role="tablist">
        {labels.map((label, index) => (
          <button
            key={label}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={active === index}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") setActive((active + 1) % labels.length);
              if (event.key === "ArrowLeft") setActive((active - 1 + labels.length) % labels.length);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {panels.map((panel, index) => (
        <div
          key={index}
          role="tabpanel"
          id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`}
          hidden={active !== index}
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
