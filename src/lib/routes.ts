/** The pages and links between them. Safe to import from the browser. */

export const PAGES = [
  { name: "Cockpit", href: "/" },
  { name: "Priority matrix", href: "/matrix" },
  { name: "Deal detail", href: "/deals" },
  { name: "Intro tracker", href: "/intros" },
  { name: "Merge queue", href: "/merges" },
  { name: "Outbox", href: "/outbox" },
  { name: "Audit log", href: "/audit" },
  { name: "How scores work", href: "/scoring" },
] as const;

/** The records behind the app, as the Lex admin listed them in the sidebar. */
export const DATA_PAGES = [
  { name: "Deal flow uploads", href: "/uploads" },
  { name: "Companies", href: "/data/companies" },
  { name: "Touchpoints (inbound records)", href: "/data/touchpoints" },
  { name: "Merge suggestions", href: "/data/merge-suggestions" },
  { name: "Decisions (audit log)", href: "/data/decisions" },
  { name: "Outbox (simulated replies)", href: "/data/outbox" },
] as const;

/** The page a path belongs to, for "← Cockpit" style back links. */
export function pageNameFor(href: string): string {
  const pathname = href.split("?")[0];
  const page = [...PAGES].reverse().find((candidate) =>
    candidate.href === "/" ? pathname === "/" : pathname === candidate.href || pathname.startsWith(`${candidate.href}/`),
  );
  if (page) return page.name;
  return DATA_PAGES.find((candidate) => pathname.startsWith(candidate.href))?.name ?? "Cockpit";
}

/** A return link the deal page may use: a path inside this app, never a deal page itself. */
export function safeReturnHref(from: string | null | undefined): string {
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) return "/";
  if (from.split("?")[0].startsWith("/deals")) return "/";
  return from;
}

export function dealHref(companyId: number, from: string): string {
  return `/deals/${companyId}?from=${encodeURIComponent(safeReturnHref(from))}`;
}

/** ``path?key=value…`` keeping only non-empty values. */
export function withQuery(path: string, query: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}
