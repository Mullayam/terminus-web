/**
 * Fuzzy subsequence matching + recency/frequency ranking for terminal
 * command suggestions. Used to order the suggestion box and pick the best
 * ghost-text completion so the most relevant command surfaces first.
 */

export interface UsageStat {
  /** How many times the command has been run. */
  count: number;
  /** Epoch ms of the last run. */
  last: number;
}

export type UsageMap = Record<string, UsageStat>;

const WORD_BOUNDARY = /[\s\-_/.:]/;

/**
 * Score how well `query` matches `target` (case-insensitive). Higher is
 * better; returns `null` when `query` is not even a subsequence of `target`.
 *
 * Tiers: exact > prefix > contiguous substring > subsequence.
 */
export function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - (t.length - q.length);

  const subIdx = t.indexOf(q);
  if (subIdx >= 0) {
    const boundary = subIdx === 0 || WORD_BOUNDARY.test(t[subIdx - 1]);
    return 500 - subIdx + (boundary ? 60 : 0);
  }

  // Subsequence match with contiguity + word-boundary bonuses.
  let qi = 0;
  let score = 0;
  let prevMatch = -2;
  let firstIdx = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (firstIdx < 0) firstIdx = ti;
      const contiguous = ti === prevMatch + 1;
      const boundary = ti === 0 || WORD_BOUNDARY.test(t[ti - 1]);
      score += 10 + (contiguous ? 15 : 0) + (boundary ? 12 : 0);
      prevMatch = ti;
      qi++;
    }
  }
  if (qi < q.length) return null;
  score -= Math.floor(t.length / 10);
  score -= firstIdx;
  return 200 + score;
}

/** Bonus from how often / how recently a command has been used. */
function usageBonus(stat: UsageStat | undefined, now: number): number {
  if (!stat) return 0;
  const freq = Math.min(stat.count, 100);
  const ageHours = (now - stat.last) / 3_600_000;
  const recency = Math.max(0, 60 - ageHours * (60 / 168)); // decays over ~1 week
  return freq * 3 + recency;
}

/**
 * Filter `items` to fuzzy matches of `query` and sort best-first, blending
 * match quality with usage stats. De-duplicates while preserving the best rank.
 */
export function rankSuggestions(
  query: string,
  items: string[],
  usage: UsageMap,
): string[] {
  const now = Date.now();
  const seen = new Set<string>();
  const scored: { text: string; score: number }[] = [];
  for (const text of items) {
    if (seen.has(text)) continue;
    seen.add(text);
    const base = fuzzyScore(query, text);
    if (base === null) continue;
    scored.push({ text, score: base + usageBonus(usage[text], now) });
  }
  scored.sort((a, b) => b.score - a.score || a.text.length - b.text.length);
  return scored.map((s) => s.text);
}

/** Cheap early-exit check: does any item fuzzy-match the query? */
export function hasFuzzyMatch(query: string, items: string[]): boolean {
  for (const t of items) {
    if (fuzzyScore(query, t) !== null) return true;
  }
  return false;
}
