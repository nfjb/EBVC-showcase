import type { Metadata } from "next";
import type { ReactNode } from "react";

import { FlashProvider } from "@/components/Flash";
import { ActingPersonSelect, NavLinks } from "@/components/SidebarClient";
import { actingMember } from "@/lib/server/person";
import { navigationCounts } from "@/lib/server/views";
import { teamNames } from "@/lib/triage/config";

import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Skarv Ventures · Deal-flow triage",
  description: "Deal-flow triage for Skarv Ventures — fictional demo data.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const counts = navigationCounts();
  const member = await actingMember();
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="shell">
          <aside className="sidebar">
            <h2 className="brand">Skarv Ventures</h2>
            <p className="caption">Deal-flow triage · fictional demo data</p>
            <NavLinks counts={counts} />
            <hr />
            <ActingPersonSelect team={teamNames()} current={member} />
          </aside>
          <main id="main" className="main">
            <FlashProvider>{children}</FlashProvider>
          </main>
        </div>
      </body>
    </html>
  );
}
