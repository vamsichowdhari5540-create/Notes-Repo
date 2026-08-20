function tokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/['’]/g, "") // "Newton's" -> "newtons", not "newton" + "s"
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Dice coefficient over whitespace-normalized word tokens — catches
 * near-duplicate note titles ("Unit 3 Notes" vs "unit-3 notes") without
 * needing a database-side fuzzy-match extension.
 *
 * Numbers get a hard veto: if both titles contain digit tokens (unit,
 * chapter, page numbers) and none match, they're treated as unrelated
 * regardless of how similar the surrounding words are — "Unit 1 Notes" and
 * "Unit 5 Notes" share every word but one and are NOT the same note.
 */
export function titleSimilarity(a: string, b: string): number {
  const aTokens = tokens(a);
  const bTokens = tokens(b);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;

  const aNumbers = aTokens.filter((t) => /^\d+$/.test(t));
  const bNumbers = bTokens.filter((t) => /^\d+$/.test(t));
  if (aNumbers.length > 0 && bNumbers.length > 0) {
    const sharesNumber = aNumbers.some((n) => bNumbers.includes(n));
    if (!sharesNumber) return 0;
  }

  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let overlap = 0;
  for (const token of aSet) {
    if (bSet.has(token)) overlap++;
  }
  return (2 * overlap) / (aSet.size + bSet.size);
}

export function findSimilarTitle<T extends { title: string }>(
  candidate: string,
  existing: T[],
  threshold = 0.6
): T | null {
  if (!candidate.trim()) return null;
  let best: T | null = null;
  let bestScore = threshold;
  for (const item of existing) {
    const score = titleSimilarity(candidate, item.title);
    if (score >= bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}
