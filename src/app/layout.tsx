import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
import type { ReactNode } from "react";

import { BrowserOnly } from "@/components/BrowserOnly";
import { FlashProvider } from "@/components/Flash";
import { ActingPersonSelect, NavLinks } from "@/components/SidebarClient";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-display" });

export const metadata: Metadata = {
  title: "Skarv Ventures · Deal-flow triage",
  description: "Deal-flow triage for Skarv Ventures — fictional demo data.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" className={cn("font-sans", inter.variable, anton.variable)}>
      <body className="text-base leading-normal">
        <a
          className="absolute top-2 -left-[9999px] z-[100] rounded-md bg-foreground px-3 py-2 text-white focus:left-2"
          href="#main"
        >
          Skip to content
        </a>
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)]">
          <aside className="border-r border-sidebar-border bg-sidebar px-4.5 py-6 text-sidebar-foreground lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto print:hidden">
            <h2 className="mb-0.5 text-[22px] font-bold">Skarv Ventures</h2>
            <p className="text-sm text-muted-foreground">Deal-flow triage · fictional demo data</p>
            <BrowserOnly>
              <NavLinks />
              <Separator className="my-4.5" />
              <ActingPersonSelect />
            </BrowserOnly>
          </aside>
          <main id="main" className="max-w-[1500px] min-w-0 px-4 pt-5 pb-12 lg:px-10 lg:pt-8 lg:pb-16 print:p-0">
            <BrowserOnly>
              <FlashProvider>{children}</FlashProvider>
            </BrowserOnly>
          </main>
        </div>
      </body>
    </html>
  );
}
