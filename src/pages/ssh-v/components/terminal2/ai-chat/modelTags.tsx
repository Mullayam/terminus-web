import type { AgentModelInfo } from '@/lib/agent/types';

export interface ModelTag {
    label: string;
    /** Theme colour key (falls back to foreground when the theme lacks it). */
    color: string;
}

const FAST_NAME = /flash|mini|haiku|turbo|instant|lite|small|fast|8b|scout/i;
const REASONING_NAME = /\bo[13]\b|r1|think|reason|opus|sonnet-4|deep|pro\b/i;

interface TagInput {
    name: string;
    id: string;
    tiers?: string[];
    complexity?: string;
    latencyMs?: number;
    contextWindow?: number;
    free?: boolean;
    supportsTools?: boolean;
}

/**
 * Derive short badges ("Fast", "Reasoning", …) for a model.
 * Prefers catalog metadata and falls back to the model name when the provider
 * list carries no tier information.
 */
export function deriveModelTags(m: TagInput): ModelTag[] {
    const tags: ModelTag[] = [];
    const tiers = (m.tiers ?? []).map((t) => t.toLowerCase());
    const complexity = m.complexity?.toLowerCase();
    const haystack = `${m.name} ${m.id}`;

    const isFast =
        tiers.includes('fast') ||
        tiers.includes('cheap') ||
        complexity === 'low' ||
        (typeof m.latencyMs === 'number' && m.latencyMs > 0 && m.latencyMs < 800) ||
        FAST_NAME.test(haystack);

    const isReasoning =
        tiers.includes('reasoning') ||
        tiers.includes('thinking') ||
        complexity === 'high' ||
        REASONING_NAME.test(haystack);

    // Reasoning wins when a model matches both — it's the more useful signal.
    if (isReasoning) tags.push({ label: 'Reasoning', color: 'magenta' });
    else if (isFast) tags.push({ label: 'Fast', color: 'yellow' });

    if (m.free) tags.push({ label: 'Free', color: 'green' });
    if (m.supportsTools) tags.push({ label: 'Tools', color: 'cyan' });
    if ((m.contextWindow ?? 0) >= 200_000) tags.push({ label: 'Long ctx', color: 'blue' });

    return tags.slice(0, 3);
}

export function agentModelTags(m: AgentModelInfo): ModelTag[] {
    return deriveModelTags({
        name: m.label ?? m.model,
        id: m.model,
        tiers: m.tiers,
        complexity: m.complexity,
        latencyMs: m.latencyMs,
        contextWindow: m.contextWindow,
        free: m.free,
        supportsTools: m.supportsTools,
    });
}

export function ModelTags({ tags, colors }: { tags: ModelTag[]; colors: Record<string, string> }) {
    if (tags.length === 0) return null;
    return (
        <span className="flex items-center gap-1 shrink-0">
            {tags.map((t) => {
                const c = colors[t.color] ?? `${colors.foreground}80`;
                return (
                    <span
                        key={t.label}
                        className="px-1 py-px rounded text-[8px] font-medium uppercase tracking-wide leading-none"
                        style={{ backgroundColor: `${c}1e`, color: c }}
                    >
                        {t.label}
                    </span>
                );
            })}
        </span>
    );
}
