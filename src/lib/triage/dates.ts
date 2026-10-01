/**
 * Calendar dates as ``YYYY-MM-DD`` strings, computed in UTC so no timezone can move a day.
 *
 * ISO strings sort and compare correctly as plain strings, which is how the pipeline
 * compares ``received_at`` and ``event_date``.
 */

export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toUtcMs(day: IsoDate): number {
  const match = ISO_DATE.exec(day);
  if (!match) throw new Error(`Invalid isoformat string: '${day}'`);
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, date);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== date) {
    throw new Error(`Invalid isoformat string: '${day}'`);
  }
  return ms;
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** ``datetime.date.fromisoformat`` for ``YYYY-MM-DD``: validates and returns the same string. */
export function parseIsoDate(value: string): IsoDate {
  return fromUtcMs(toUtcMs(value));
}

export function addDays(day: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(day) + days * DAY_MS);
}

/** ``(end - start).days`` */
export function daysBetween(start: IsoDate, end: IsoDate): number {
  return Math.round((toUtcMs(end) - toUtcMs(start)) / DAY_MS);
}

/** Python's ``date.weekday()``: Monday is 0, Sunday is 6. */
export function weekday(day: IsoDate): number {
  return (new Date(toUtcMs(day)).getUTCDay() + 6) % 7;
}

function parts(day: IsoDate) {
  const date = new Date(toUtcMs(day));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    date: date.getUTCDate(),
    weekday: weekday(day),
  };
}

/** ``%a`` → ``Wed`` */
export function shortWeekday(day: IsoDate): string {
  return WEEKDAYS[weekday(day)].slice(0, 3);
}

/** ``%b %Y`` → ``Aug 2026`` (how a signal is dated in ``latest_signal``). */
export function monthYear(day: IsoDate): string {
  const { year, month } = parts(day);
  return `${MONTHS[month].slice(0, 3)} ${year}`;
}

/** ``f"{day:%a} {day.day} {day:%b}"`` → ``Wed 30 Sep`` */
export function longDate(day: IsoDate): string {
  const { month, date } = parts(day);
  return `${shortWeekday(day)} ${date} ${MONTHS[month].slice(0, 3)}`;
}

/** ``f"{day:%a} {day.day} {day:%b %Y}"`` → ``Wed 30 Sep 2026`` */
export function longDateWithYear(day: IsoDate): string {
  return `${longDate(day)} ${parts(day).year}`;
}

/** ``f"{day:%A} {day.day} {day:%B}"`` → ``Wednesday 7 October`` */
export function fullDate(day: IsoDate): string {
  const { month, date, weekday: index } = parts(day);
  return `${WEEKDAYS[index]} ${date} ${MONTHS[month]}`;
}

/** ``%d %b`` → ``04 Aug`` */
export function dayMonth(day: IsoDate): string {
  const { month, date } = parts(day);
  return `${String(date).padStart(2, "0")} ${MONTHS[month].slice(0, 3)}`;
}

/** A timestamp shown as ``D MMM YYYY, HH:mm`` (UTC), as the audit log displays it. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const time = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()].slice(0, 3)} ${date.getUTCFullYear()}, ${time}`;
}

/** A timestamp shown as ``%d %b %H:%M`` (UTC), as the Outbox labels a message. */
export function formatShortTimestamp(iso: string): string {
  const date = new Date(iso);
  const time = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  return `${String(date.getUTCDate()).padStart(2, "0")} ${MONTHS[date.getUTCMonth()].slice(0, 3)} ${time}`;
}
