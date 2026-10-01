"use client";

/** The app's shadcn Sidebar: pages with their open-work counts, the data views, and who is acting. */

import {
  ArrowRightLeft,
  Compass,
  Database,
  Gauge,
  Handshake,
  ReceiptText,
  Search,
  Send,
  Upload,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";

import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { setActingPersonAction } from "@/lib/crm/actions";
import { navigationCounts } from "@/lib/crm/views";
import { DATA_PAGES, PAGES } from "@/lib/routes";
import { teamNames } from "@/lib/triage/config";

import { useActingMember, useCrm } from "./useCrm";
import { useMounted } from "./BrowserOnly";

const ICONS: Record<string, LucideIcon> = {
  "/": Gauge,
  "/matrix": Compass,
  "/deals": Search,
  "/intros": Handshake,
  "/merges": ArrowRightLeft,
  "/outbox": Send,
  "/audit": ReceiptText,
  "/uploads": Upload,
};

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function Counts({ name }: { name: string }) {
  useCrm();
  const count = navigationCounts()[name];
  return count ? (
    <SidebarMenuBadge>
      {count}
      <span className="sr-only"> open</span>
    </SidebarMenuBadge>
  ) : null;
}

export function AppSidebar() {
  const pathname = usePathname();
  const mounted = useMounted();
  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  S
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">Skarv Ventures</span>
                  <span className="truncate text-xs text-muted-foreground">Deal-flow triage · demo data</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Go to</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PAGES.map((page) => {
                const Icon = ICONS[page.href];
                const active = isActive(pathname, page.href);
                return (
                  <SidebarMenuItem key={page.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={page.name}>
                      <Link href={page.href} aria-current={active ? "page" : undefined}>
                        <Icon aria-hidden="true" />
                        <span>{page.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    {mounted ? <Counts name={page.name} /> : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Data</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DATA_PAGES.map((page) => {
                const active = isActive(pathname, page.href);
                const Icon = ICONS[page.href] ?? Database;
                return (
                  <SidebarMenuItem key={page.href}>
                    <SidebarMenuButton asChild isActive={active} size="sm" tooltip={page.name}>
                      <Link href={page.href} aria-current={active ? "page" : undefined}>
                        <Icon aria-hidden="true" />
                        <span>{page.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        {mounted ? <ActingPersonSelect /> : <Skeleton className="h-16 w-full" />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ActingPersonSelect() {
  const team = teamNames();
  const current = useActingMember();
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-1.5 p-1">
      <Label htmlFor="acting-person" className="text-xs">
        Acting as (demo, not signed in)
      </Label>
      <Select
        value={current}
        disabled={pending}
        onValueChange={(name) => startTransition(() => setActingPersonAction(name))}
      >
        <SelectTrigger id="acting-person" className="w-full bg-background" aria-describedby="acting-help">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {team.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <small id="acting-help" className="text-xs text-muted-foreground">
        Every decision is logged under this name.
      </small>
    </div>
  );
}
