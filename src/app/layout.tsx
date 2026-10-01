import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { AgentStatusBar } from "@/components/AgentStatusBar";
import { AppHeader } from "@/components/AppHeader";
import { BrowserOnly } from "@/components/BrowserOnly";
import { AppSidebar } from "@/components/SidebarClient";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Skarv Ventures · Deal-flow triage",
  description: "Deal-flow triage for Skarv Ventures — fictional demo data.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" className={cn("font-sans", inter.variable)}>
      <body>
        <a
          className="absolute top-2 -left-[9999px] z-[100] rounded-md bg-foreground px-3 py-2 text-background focus:left-2"
          href="#main"
        >
          Skip to content
        </a>
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-w-0">
              <AppHeader />
              <div id="main" className="mx-auto w-full max-w-[1400px] min-w-0 px-4 py-6 lg:px-8 print:p-0">
                <BrowserOnly>
                  <AgentStatusBar />
                  {children}
                </BrowserOnly>
              </div>
            </SidebarInset>
          </SidebarProvider>
          <Toaster position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
