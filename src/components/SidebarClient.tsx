"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";

import { setActingPersonAction } from "@/app/actions";
import { DATA_PAGES, PAGES } from "@/lib/routes";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ counts }: { counts: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <>
      <nav aria-label="Pages" className="nav">
        <p className="nav-label">Go to</p>
        <ul>
          {PAGES.map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className={isActive(pathname, page.href) ? "nav-link active" : "nav-link"}
                aria-current={isActive(pathname, page.href) ? "page" : undefined}
              >
                <span aria-hidden="true">{page.icon}</span> {page.name}
                {counts[page.name] ? <span className="nav-count"> · {counts[page.name]}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Data" className="nav nav-data">
        <p className="nav-label">Data</p>
        <ul>
          {DATA_PAGES.map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className={isActive(pathname, page.href) ? "nav-link small active" : "nav-link small"}
                aria-current={isActive(pathname, page.href) ? "page" : undefined}
              >
                {page.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export function ActingPersonSelect({ team, current }: { team: string[]; current: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="field acting">
      <span>Acting as (demo, not signed in)</span>
      <select
        value={current}
        disabled={pending}
        onChange={(event) => {
          const name = event.target.value;
          startTransition(() => setActingPersonAction(name));
        }}
        aria-describedby="acting-help"
      >
        {team.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <small id="acting-help">Every decision is logged under this name.</small>
    </label>
  );
}
