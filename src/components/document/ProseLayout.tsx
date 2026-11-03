'use client';

import React from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import type { DraftBlock } from '@/contracts';
import { AlertTriangle, FileText } from 'lucide-react';

interface ProseLayoutProps {
  blocks: DraftBlock[];
  groundingPolicy: 'strict' | 'facts' | 'creative';
}

export const ProseLayout: React.FC<ProseLayoutProps> = ({
  blocks,
  groundingPolicy,
}) => {
  const { focusedEvidenceId, setFocusedEvidenceId, currentTTSBlockId } = useMunshiStore();

  const getBlock = (role: string) => blocks.find((b) => b.role === role);
  const title = getBlock('title');
  const otherBlocks = blocks.filter((b) => b.role !== 'title');

  const renderBlockWithGrounding = (block: DraftBlock, className = '') => {
    const isPlaying = currentTTSBlockId === block.id;
    const isUnverified = block.grounding === 'unverified';

    return (
      <div
        key={block.id}
        className={`group relative rounded-lg p-1.5 transition-all ${
          isPlaying ? 'bg-amber-100/70 ring-2 ring-amber-400' : 'hover:bg-slate-50/70'
        } ${className}`}
      >
        {block.role === 'heading' ? (
          <h3 className="text-base font-bold text-slate-900 mt-4 mb-2">{block.text}</h3>
        ) : (
          <p className="whitespace-pre-line leading-relaxed text-slate-800 text-justify">
            {block.text}
          </p>
        )}

        {groundingPolicy !== 'creative' && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {block.evidenceIds.map((evId) => (
              <button
                key={evId}
                type="button"
                onClick={() =>
                  setFocusedEvidenceId(focusedEvidenceId === evId ? null : evId)
                }
                className="flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 hover:bg-slate-200"
              >
                <FileText className="h-2.5 w-2.5" />
                <span>Citation</span>
              </button>
            ))}

            {isUnverified && (
              <span className="flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700 border border-rose-200">
                <AlertTriangle className="h-2.5 w-2.5 text-rose-600" />
                Unverified
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="layout-prose mx-auto max-w-2xl space-y-4 text-sm leading-relaxed text-slate-900 font-normal">
      {title && (
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 border-b border-slate-200 pb-3 text-center tracking-tight">
          {title.text}
        </h1>
      )}

      <div className="space-y-4 pt-2">
        {otherBlocks.map((b) => renderBlockWithGrounding(b))}
      </div>
    </div>
  );
};
