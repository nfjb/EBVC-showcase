/**
 * Python semantics the triage rules depend on, reproduced exactly.
 *
 * The rules were first written in Python. Where JavaScript's built-ins behave differently
 * (rounding ties, what counts as whitespace or a word character) the result would drift on
 * edge cases, so those few primitives live here.
 */

/** Characters Python's ``str.isspace()`` treats as whitespace (``str.strip()`` / ``str.split()``). */
const PY_WHITESPACE =
  "\\t\\n\\x0b\\x0c\\r\\x1c\\x1d\\x1e\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";

/** Python ``re`` with a ``str`` pattern: ``\w`` is Unicode letters, numbers and underscore. */
export const PY_WORD_CLASS = "\\p{L}\\p{N}_";
export const PY_SPACE_CLASS = PY_WHITESPACE;

const STRIP_PATTERN = new RegExp(`^[${PY_WHITESPACE}]+|[${PY_WHITESPACE}]+$`, "gu");
const SPLIT_PATTERN = new RegExp(`[${PY_WHITESPACE}]+`, "u");

/** ``str.strip()`` with no argument. */
export function pyStrip(value: string): string {
  return value.replace(STRIP_PATTERN, "");
}

/** ``str.split()`` with no argument: split on whitespace runs, drop empty pieces. */
export function pySplit(value: string): string[] {
  const stripped = pyStrip(value);
  return stripped === "" ? [] : stripped.split(SPLIT_PATTERN);
}

/** ``str.strip(chars)`` for a set of literal characters. */
export function pyStripChars(value: string, chars: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && chars.includes(value[start])) start += 1;
  while (end > start && chars.includes(value[end - 1])) end -= 1;
  return value.slice(start, end);
}

/** ``str.rstrip(chars)`` for a set of literal characters. */
export function pyRstripChars(value: string, chars: string): string {
  let end = value.length;
  while (end > 0 && chars.includes(value[end - 1])) end -= 1;
  return value.slice(0, end);
}

/**
 * Python's ``round(x, ndigits)``: round half to even, decided on the exact binary value of
 * ``x`` (so ``round(2.675, 2) == 2.67`` and ``round(2.25, 1) == 2.2``). ``Math.round`` and
 * ``toFixed`` round exact ties away from zero instead.
 */
export function pyRound(value: number, ndigits = 0): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const negative = value < 0;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, Math.abs(value));
  const bits = view.getBigUint64(0);
  const exponentBits = Number((bits >> 52n) & 0x7ffn);
  let mantissa = bits & ((1n << 52n) - 1n);
  let exponent: number;
  if (exponentBits === 0) {
    exponent = -1074;
  } else {
    mantissa |= 1n << 52n;
    exponent = exponentBits - 1075;
  }
  // |value| = mantissa × 2^exponent, exactly. Scale by 10^ndigits and round half to even.
  let numerator = mantissa * 10n ** BigInt(ndigits);
  let denominator = 1n;
  if (exponent >= 0) numerator <<= BigInt(exponent);
  else denominator <<= BigInt(-exponent);
  let quotient = numerator / denominator;
  const twiceRemainder = 2n * (numerator - quotient * denominator);
  if (twiceRemainder > denominator || (twiceRemainder === denominator && (quotient & 1n) === 1n)) {
    quotient += 1n;
  }
  // The decimal string parses to the double nearest the rounded decimal, as Python returns.
  const rounded = Number(`${quotient}e-${ndigits}`);
  return negative ? -rounded : rounded;
}

/** Python's ``f"{value:.{digits}f}"`` (round half to even on the exact value). */
export function pyFixed(value: number, digits: number): string {
  return pyRound(value, digits).toFixed(digits);
}

/** Python's ``int(float(value))`` as used by the pipeline's ``to_int``: ``null`` when it fails. */
export function pyToInt(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const text = pyStrip(String(value)).replace(/(?<=\d)_(?=\d)/g, "");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)) return null;
  const parsed = Number(text);
  // int(float("1e400")) raises OverflowError in Python; treat it as unreadable.
  if (!Number.isFinite(parsed)) return null;
  const truncated = Math.trunc(parsed);
  return truncated === 0 ? 0 : truncated;
}

/** ``dict.get(key, default)`` that never reads ``Object.prototype`` (``"constructor"`` …). */
export function pyGet<V, D>(mapping: Record<string, V>, key: string, fallback: D): V | D {
  return Object.hasOwn(mapping, key) ? mapping[key] : fallback;
}

/** ``re.escape`` for use inside a JavaScript ``u``-flag pattern. */
export function escapeRegExp(value: string): string {
  // Only syntax characters and "/": any other identity escape is an error under the u flag.
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/** Python ``str`` ordering: compares by code point, not UTF-16 unit or locale. */
export function compareCodePoints(first: string, second: string): number {
  const a = Array.from(first);
  const b = Array.from(second);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = a[index].codePointAt(0)! - b[index].codePointAt(0)!;
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}
