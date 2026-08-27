import { useState } from 'react';
import { ChevronsUpDown, RefreshCw } from 'lucide-react';
import type { AIModelOption, AIProvider } from '@/store/aiChatStore';
import { deriveModelTags, ModelTags } from './modelTags';

export function ModelPicker({
  providers,
  fetching,
  onRefresh,
  selectedModel,
  onSelect,
  colors,
}: {
  providers: AIProvider[];
  fetching: boolean;
  onRefresh: () => void;
  selectedModel?: AIModelOption;
  onSelect: (model: AIModelOption) => void;
  colors: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const available = providers.filter((p) => p.available);

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors hover:brightness-125"
        style={{
          backgroundColor: `${colors.foreground}10`,
          color: `${colors.foreground}70`,
          border: `1px solid ${colors.foreground}15`,
        }}
        title="Select AI model"
      >
        <span className="max-w-[90px] truncate">{selectedModel?.label ?? 'No model'}</span>
        <ChevronsUpDown size={10} />
      </button>
      <button
        onClick={onRefresh}
        disabled={fetching}
        className="p-1 rounded transition-colors hover:bg-white/10 disabled:opacity-30"
        title="Refresh providers"
      >
        <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} style={{ color: `${colors.foreground}60` }} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 rounded-lg border py-1 shadow-xl min-w-[180px] max-h-[300px] overflow-y-auto"
          style={{ backgroundColor: colors.background, borderColor: `${colors.foreground}20` }}
        >
          {available.map((provider) => (
            <div key={provider.id}>
              <div
                className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider"
                style={{ color: `${colors.foreground}40` }}
              >
                {provider.name}
              </div>
              {provider.models.map((model) => {
                const active =
                  selectedModel?.modelId === model.id && selectedModel?.providerId === provider.id;
                return (
                  <button
                    key={`${provider.id}-${model.id}`}
                    onClick={() => {
                      onSelect({ providerId: provider.id, modelId: model.id, label: model.name });
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[11px] transition-colors hover:brightness-125 flex items-center justify-between gap-2"
                    style={{
                      color: active ? colors.cyan : `${colors.foreground}80`,
                      backgroundColor: active ? `${colors.cyan}10` : 'transparent',
                    }}
                  >
                    <span className="truncate">{model.name}</span>
                    <ModelTags
                      tags={deriveModelTags({
                        name: model.name,
                        id: model.id,
                        contextWindow: model.maxTokens,
                        supportsTools: model.supportsTools,
                      })}
                      colors={colors}
                    />
                  </button>
                );
              })}
            </div>
          ))}
          {available.length === 0 && (
            <div className="px-3 py-2 text-[11px]" style={{ color: `${colors.foreground}40` }}>
              No models available
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ModelPicker;
