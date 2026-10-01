"use client";

import {
  ArrowRightLeft,
  Compass,
  Gauge,
  Handshake,
  ReceiptText,
  Search,
  Send,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setActingPersonAction } from "@/lib/crm/actions";
import { navigationCounts } from "@/lib/crm/views";
import { DATA_PAGES, PAGES } from "@/lib/routes";
import { teamNames } from "@/lib/triage/config";
import { cn } from "@/lib/utils";

import { useActingMember, useCrm } from "./useCrm";

const ICONS: Record<string, LucideIcon> = {
  "/": Gauge,
  "/matrix": Compass,
  "/deals": Search,
  "/intros": Handshake,
  "/merges": ArrowRightLeft,
  "/outbox": Send,
  "/audit": ReceiptText,
};

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function navClass(active: boolean, small = false): string {
  return cn(
    "flex items-center gap-2 rounded-lg px-2.5 no-underline transition-colors",
    small ? "py-1 text-sm" : "py-1.5 text-[15px] font-medium",
    active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent",
  );
}

export function NavLinks() {
  useCrm();
  const counts = navigationCounts();
  const pathname = usePathname();
  return (
    <>
      <nav aria-label="Pages">
        <p className="mt-5 mb-1.5 text-[13px] text-muted-foreground">Go to</p>
        <ul className="space-y-0.5">
          {PAGES.map((page) => {
            const active = isActive(pathname, page.href);
            const Icon = ICONS[page.href];
            return (
              <li key={page.href}>
                <Link href={page.href} className={navClass(active)} aria-current={active ? "page" : undefined}>
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{page.name}</span>
                  {counts[page.name] ? (
                    <Badge variant={active ? "outline" : "muted"} className={cn(active && "border-white/40 text-white")}>
                      {counts[page.name]}
                      <span className="sr-only"> open</span>
                    </Badge>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <nav aria-label="Data">
        <p className="mt-5 mb-1.5 text-[13px] text-muted-foreground">Data</p>
        <ul className="space-y-0.5">
          {DATA_PAGES.map((page) => {
            const active = isActive(pathname, page.href);
            return (
              <li key={page.href}>
                <Link href={page.href} className={navClass(active, true)} aria-current={active ? "page" : undefined}>
                  {page.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function ActingPersonSelect() {
  const team = teamNames();
  const current = useActingMember();
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="acting-person">Acting as (demo, not signed in)</Label>
      <Select
        value={current}
        disabled={pending}
        onValueChange={(name) => startTransition(() => setActingPersonAction(name))}
      >
        <SelectTrigger id="acting-person" className="w-full bg-card" aria-describedby="acting-help">
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
      <small id="acting-help" className="text-[13px] text-muted-foreground">
        Every decision is logged under this name.
      </small>
    </div>
  );
}
