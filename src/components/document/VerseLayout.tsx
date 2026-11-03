'use client';

import React from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import type { DraftBlock } from '@/contracts';
import { Sparkles, AlertTriangle } from 'lucide-react';

interface VerseLayoutProps {
  blocks: DraftBlock[];
  groundingPolicy: 'strict' | 'facts' | 'creative';
}

export const VerseLayout: React.FC<VerseLayoutProps> = ({
  blocks,
  groundingPolicy,
}) => {
  const { currentTTSBlockId } = useMunshiStore();

  const title = blocks.find((b) => b.role === 'title');
  const stanzas = blocks.filter((b) => b.role !== 'title');

  return (
    <div className="layout-verse mx-auto max-w-xl py-6 text-center space-y-8 font-serif">
      {title && (
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-wide font-sans">
            {title.text}
          </h1>
          <div className="mx-auto h-0.5 w-12 bg-munshi-400 rounded-full" />
        </div>
      )}

      <div className="space-y-6">
        {stanzas.map((stanza) => {
          const isPlaying = currentTTSBlockId === stanza.id;
          const isUnverified = stanza.grounding === 'unverified';

          return (
            <div
              key={stanza.id}
              className={`rounded-2xl p-4 transition-all ${
                isPlaying ? 'bg-amber-100/70 ring-2 ring-amber-400' : 'hover:bg-slate-50/60'
              }`}
            >
              <p className="whitespace-pre-line text-base text-slate-800 leading-loose italic">
                {stanza.text}
              </p>

              {isUnverified && (
                <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-rose-600 font-sans not-italic">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Real identifier warning</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
