'use client';

import React from 'react';
import type { DraftBlock } from '@/contracts';
import { EditableBlock } from './EditableBlock';

interface VerseLayoutProps {
  blocks: DraftBlock[];
  groundingPolicy: 'strict' | 'facts' | 'creative';
}

export const VerseLayout: React.FC<VerseLayoutProps> = ({
  blocks,
  groundingPolicy,
}) => {
  const title = blocks.find((b) => b.role === 'title');
  const stanzas = blocks.filter((b) => b.role !== 'title');

  return (
    <div className="layout-verse mx-auto max-w-xl py-6 text-center space-y-8 font-serif">
      {title && (
        <div className="space-y-2">
          <EditableBlock
            block={title}
            groundingPolicy={groundingPolicy}
            textareaClassName="text-2xl font-bold text-slate-900 tracking-wide font-sans text-center"
            placeholder="Poem Title..."
          />
          <div className="mx-auto h-0.5 w-12 bg-munshi-400 rounded-full" />
        </div>
      )}

      <div className="space-y-6">
        {stanzas.map((stanza) => (
          <div key={stanza.id} className="rounded-2xl p-2 transition-all">
            <EditableBlock
              block={stanza}
              groundingPolicy={groundingPolicy}
              textareaClassName="text-base text-slate-800 leading-loose italic text-center"
              placeholder="Type stanza here..."
            />
          </div>
        ))}
      </div>
    </div>
  );
};
