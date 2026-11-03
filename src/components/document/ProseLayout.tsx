'use client';

import React from 'react';
import type { DraftBlock } from '@/contracts';
import { EditableBlock } from './EditableBlock';

interface ProseLayoutProps {
  blocks: DraftBlock[];
  groundingPolicy: 'strict' | 'facts' | 'creative';
}

export const ProseLayout: React.FC<ProseLayoutProps> = ({
  blocks,
  groundingPolicy,
}) => {
  const getBlock = (role: string) => blocks.find((b) => b.role === role);
  const title = getBlock('title');
  const otherBlocks = blocks.filter((b) => b.role !== 'title');

  return (
    <div className="layout-prose mx-auto max-w-2xl space-y-4 text-sm leading-relaxed text-slate-900 font-normal">
      {title && (
        <div className="border-b border-slate-200 pb-3 mb-2">
          <EditableBlock
            block={title}
            groundingPolicy={groundingPolicy}
            textareaClassName="text-xl sm:text-2xl font-bold text-slate-900 text-center tracking-tight"
            placeholder="Document Title..."
          />
        </div>
      )}

      <div className="space-y-4 pt-1">
        {otherBlocks.map((b) => (
          <EditableBlock
            key={b.id}
            block={b}
            groundingPolicy={groundingPolicy}
            textareaClassName={
              b.role === 'heading'
                ? 'text-base font-bold text-slate-900'
                : 'leading-relaxed text-slate-800 text-justify sm:text-left'
            }
            placeholder={
              b.role === 'heading' ? 'Heading...' : 'Type paragraph here...'
            }
          />
        ))}
      </div>
    </div>
  );
};
