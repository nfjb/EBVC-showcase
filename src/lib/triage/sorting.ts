/**
 * Sorting the score tables (cockpit worklists, matrix list) by Quality, Urgency or Total
 * Score, from the URL (``?sort=…&dir=…``). Without a sort, lists keep the priority order,
 * pinned ranks included, which is the Total Score descending.
 */

export type SortColumn = "quality" | "urgency" | "total";
export type SortDirection = "asc" | "desc";

/** How a list is sorted: by a score column, or (null) by priority with pinned ranks. */
export interface SortState {
  column: SortColumn | null;
  direction: SortDirection;
}

/** Read ``?sort=…&dir=…``; anything unknown falls back to the priority order. */
export function readSort(params: Record<string, string>): SortState {
  const column = (["quality", "urgency", "total"] as const).find((value) => value === params.sort) ?? null;
  return { column, direction: params.dir === "asc" ? "asc" : "desc" };
}

/** The query values a click on ``column`` sets: first descending, then flip. */
export function nextSort(state: SortState, column: SortColumn): { sort: string; dir: string } {
  const current = state.column ?? "total";
  const direction = current === column && state.direction === "desc" ? "asc" : "desc";
  return { sort: column, dir: direction };
}

/** ``aria-sort`` for a column's <th>. */
export function ariaSort(sort: SortState, column: SortColumn): "ascending" | "descending" | "none" {
  return (sort.column ?? "total") === column ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
}

/** Sort score lines by a column; equal values keep their priority order (stable). */
export function sortByScore<T>(
  items: T[],
  sort: SortState,
  values: (item: T) => { quality: number; urgency: number; total: number },
): T[] {
  if (!sort.column) return items;
  const column = sort.column;
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => sign * (values(a)[column] - values(b)[column]));
}
