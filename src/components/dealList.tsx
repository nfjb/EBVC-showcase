"use client";

/**
 * The list a deal is opened from, so Deal detail can step through it (previous / next and
 * "3 of 20"). Each list page remembers its list when it is shown, as the Streamlit app kept it
 * in the session; it lives in this browser tab only.
 */

import { useEffect } from "react";

const KEY = "skarv.dealList";
const LAST_DEAL_KEY = "skarv.lastDeal";

export interface RememberedList {
  title: string;
  ids: number[];
}

export function rememberDealList(title: string, ids: number[]): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ title, ids }));
  } catch {
    // Storage blocked: Deal detail falls back to the team worklist.
  }
}

export function readDealList(): RememberedList | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (value && typeof value.title === "string" && Array.isArray(value.ids)) return value;
  } catch {
    // Unreadable: treat as no list.
  }
  return null;
}

export function rememberLastDeal(companyId: number): void {
  try {
    sessionStorage.setItem(LAST_DEAL_KEY, String(companyId));
  } catch {
    // Not essential.
  }
}

export function readLastDeal(): number | null {
  try {
    const value = Number(sessionStorage.getItem(LAST_DEAL_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Render on a list page: remembers the list it shows. */
export function RememberDealList({ title, ids }: RememberedList) {
  const key = ids.join(",");
  useEffect(() => {
    rememberDealList(title, key ? key.split(",").map(Number) : []);
  }, [title, key]);
  return null;
}
