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

/** Relevance tiers, higher = more relevant. Used to filter out loose matches. */
const TIER_SUBSEQ = 0; // loose subsequence (g…i…t inside "gzip -t")
const TIER_SUBSTR = 1; // substring inside a word (e.g. "git" in "digital")
const TIER_WORD = 2;   // substring starting at a word boundary (e.g. "sudo git")
const TIER_PREFIX = 3;
const TIER_EXACT = 4;

export interface MatchResult {
  score: number;
  /** One of the TIER_* constants; higher means a more relevant match. */
  tier: number;
}

/**
 * Score how well `query` matches `target` (case-insensitive) and classify the
 * match tier. Higher score is better; returns `null` when `query` is not even a
 * subsequence of `target`.
 *
 * Tiers: exact > prefix > word-boundary substring > mid-word substring > subsequence.
 */
export function matchScore(query: string, target: string): MatchResult | null {
  if (!query) return { score: 0, tier: TIER_PREFIX };
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (t === q) return { score: 1000, tier: TIER_EXACT };
  if (t.startsWith(q)) return { score: 800 - (t.length - q.length), tier: TIER_PREFIX };

  const subIdx = t.indexOf(q);
  if (subIdx >= 0) {
    const boundary = subIdx === 0 || WORD_BOUNDARY.test(t[subIdx - 1]);
    return {
      score: 500 - subIdx + (boundary ? 60 : 0),
      tier: boundary ? TIER_WORD : TIER_SUBSTR,
    };
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
  return { score: 200 + score, tier: TIER_SUBSEQ };
}

/**
 * Score how well `query` matches `target`. Higher is better; `null` when there
 * is no match. Thin wrapper over {@link matchScore} for score-only callers.
 */
export function fuzzyScore(query: string, target: string): number | null {
  const r = matchScore(query, target);
  return r ? r.score : null;
}

/** Bonus from how often / how recently a command has been used. */
function usageBonus(stat: UsageStat | undefined, now: number): number {
  if (!stat) return 0;
  const freq = Math.min(stat.count, 100);
  const ageHours = (now - stat.last) / 3_600_000;
  const recency = Math.max(0, 60 - ageHours * (60 / 168)); // decays over ~1 week
  return freq * 3 + recency;
}

/** Boost applied to priority items (shell history) — larger than any base score. */
const PRIORITY_BONUS = 2000;

/**
 * Filter `items` to fuzzy matches of `query` and sort best-first, blending
 * match quality with usage stats. De-duplicates while preserving the best rank.
 * Items present in `priority` (e.g. the user's shell history) are boosted so
 * they always rank above generic/pack suggestions of the same query.
 */
export function rankSuggestions(
  query: string,
  items: string[],
  usage: UsageMap,
  priority?: Set<string>,
): string[] {
  const now = Date.now();
  const seen = new Set<string>();
  const scored: { text: string; score: number; tier: number }[] = [];
  let maxTier = -1;
  for (const text of items) {
    if (seen.has(text)) continue;
    seen.add(text);
    const m = matchScore(query, text);
    if (m === null) continue;
    const bonus = priority?.has(text) ? PRIORITY_BONUS : 0;
    scored.push({ text, score: m.score + usageBonus(usage[text], now) + bonus, tier: m.tier });
    if (m.tier > maxTier) maxTier = m.tier;
  }
  // Relevance gate: once the query yields word-boundary/prefix matches, drop the
  // loose mid-word-substring and subsequence matches so typing "git" surfaces
  // only related commands (git, git commit, sudo git) — not "digital"/"gzip -t".
  const ranked = query && maxTier >= TIER_WORD
    ? scored.filter((s) => s.tier >= TIER_WORD)
    : scored;
  ranked.sort((a, b) => b.score - a.score || a.text.length - b.text.length);
  return ranked.map((s) => s.text);
}

/** Cheap early-exit check: does any item fuzzy-match the query? */
export function hasFuzzyMatch(query: string, items: string[]): boolean {
  for (const t of items) {
    if (fuzzyScore(query, t) !== null) return true;
  }
  return false;
}
