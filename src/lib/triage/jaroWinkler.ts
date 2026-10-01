/**
 * Jaro-Winkler similarity, matching ``rapidfuzz.distance.JaroWinkler.similarity`` (prefix
 * weight 0.1, at most 4 prefix characters, boost applied only above 0.7) on code points.
 */

const PREFIX_WEIGHT = 0.1;

function jaroSimilarity(first: number[], second: number[]): number {
  const firstLength = first.length;
  const secondLength = second.length;
  if (!firstLength || !secondLength) return 0;
  if (firstLength === 1 && secondLength === 1) return first[0] === second[0] ? 1 : 0;

  const bound = Math.max(0, Math.floor(Math.max(firstLength, secondLength) / 2) - 1);
  const firstFlags = new Array<boolean>(firstLength).fill(false);
  const secondFlags = new Array<boolean>(secondLength).fill(false);

  // Each character of the second string takes the first unmatched equal character of the
  // first string within the window.
  let common = 0;
  for (let j = 0; j < secondLength; j += 1) {
    const low = Math.max(0, j - bound);
    const high = Math.min(firstLength - 1, j + bound);
    for (let i = low; i <= high; i += 1) {
      if (!firstFlags[i] && first[i] === second[j]) {
        firstFlags[i] = true;
        secondFlags[j] = true;
        common += 1;
        break;
      }
    }
  }
  if (!common) return 0;

  let transpositions = 0;
  let j = 0;
  for (let i = 0; i < firstLength; i += 1) {
    if (!firstFlags[i]) continue;
    while (!secondFlags[j]) j += 1;
    if (first[i] !== second[j]) transpositions += 1;
    j += 1;
  }
  transpositions = Math.floor(transpositions / 2);

  let similarity = 0;
  similarity += common / firstLength;
  similarity += common / secondLength;
  similarity += (common - transpositions) / common;
  return similarity / 3;
}

export function jaroWinklerSimilarity(firstText: string, secondText: string): number {
  const first = Array.from(firstText, (character) => character.codePointAt(0)!);
  const second = Array.from(secondText, (character) => character.codePointAt(0)!);
  if (!first.length && !second.length) return 1;
  const maxPrefix = Math.min(first.length, second.length, 4);
  let prefix = 0;
  while (prefix < maxPrefix && first[prefix] === second[prefix]) prefix += 1;
  let similarity = jaroSimilarity(first, second);
  if (similarity > 0.7) similarity += prefix * PREFIX_WEIGHT * (1 - similarity);
  return similarity;
}
