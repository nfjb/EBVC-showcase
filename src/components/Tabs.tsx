"use client";

import { Children, type ReactNode } from "react";

import { Tabs as TabsRoot, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** shadcn Tabs over panels (one child per label). */
export function Tabs({ labels, children }: { labels: string[]; children: ReactNode }) {
  const panels = Children.toArray(children);
  return (
    <TabsRoot defaultValue="0" className="mt-6">
      <TabsList>
        {labels.map((label, index) => (
          <TabsTrigger key={label} value={String(index)}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {panels.map((panel, index) => (
        <TabsContent key={index} value={String(index)} className="pt-3 text-base">
          {panel}
        </TabsContent>
      ))}
    </TabsRoot>
  );
}
