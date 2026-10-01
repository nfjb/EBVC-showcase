"use client";

import { Children, type ReactNode } from "react";

import { Tabs as TabsRoot, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Tabs over panels (one child per label). */
export function Tabs({ labels, children }: { labels: string[]; children: ReactNode }) {
  const panels = Children.toArray(children);
  return (
    <TabsRoot defaultValue="0" className="mt-5">
      <TabsList variant="line" className="h-auto w-full justify-start border-b pb-1">
        {labels.map((label, index) => (
          <TabsTrigger
            key={label}
            value={String(index)}
            className="flex-none px-3 py-1.5 text-[15px] font-semibold group-data-[variant=line]/tabs-list:data-active:after:bg-primary"
          >
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
