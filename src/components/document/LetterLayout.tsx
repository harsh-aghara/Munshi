'use client';

import React from 'react';
import type { DraftBlock } from '@/contracts';
import { EditableBlock } from './EditableBlock';

interface LetterLayoutProps {
  blocks: DraftBlock[];
  groundingPolicy: 'strict' | 'facts' | 'creative';
}

export const LetterLayout: React.FC<LetterLayoutProps> = ({
  blocks,
  groundingPolicy,
}) => {
  const getBlock = (role: string) => blocks.find((b) => b.role === role);
  const getBlocks = (role: string) => blocks.filter((b) => b.role === role);

  const sender = getBlock('sender');
  const date = getBlock('date');
  const recipient = getBlock('recipient');
  const subject = getBlock('subject');
  const salutation = getBlock('salutation');
  const bodyBlocks = getBlocks('body');
  const closing = getBlock('closing');
  const enclosures = getBlock('enclosures');
  const disclaimer = getBlock('disclaimer');

  return (
    <div className="layout-letter mx-auto max-w-3xl space-y-6 text-sm text-slate-900 leading-relaxed font-normal">
      {/* Sender and Date row */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-100 pb-4">
        {sender && (
          <div className="font-medium text-slate-700 max-w-xs flex-1">
            <EditableBlock
              block={sender}
              groundingPolicy={groundingPolicy}
              textareaClassName="font-medium text-slate-700"
              placeholder="Sender details / Name..."
            />
          </div>
        )}
        {date && (
          <div className="sm:text-right font-medium text-slate-600 ml-auto max-w-xs">
            <EditableBlock
              block={date}
              groundingPolicy={groundingPolicy}
              textareaClassName="sm:text-right font-medium text-slate-600"
              placeholder="Date..."
            />
          </div>
        )}
      </div>

      {/* Recipient */}
      {recipient && (
        <div className="max-w-md font-medium text-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 px-1.5">
            To:
          </div>
          <EditableBlock
            block={recipient}
            groundingPolicy={groundingPolicy}
            textareaClassName="font-medium text-slate-800"
            placeholder="Recipient details..."
          />
        </div>
      )}

      {/* Subject Line */}
      {subject && (
        <div className="rounded-xl bg-slate-50/90 p-1 border-l-4 border-munshi-600 shadow-soft-sm">
          <EditableBlock
            block={subject}
            groundingPolicy={groundingPolicy}
            prefix={<span className="text-slate-500 font-semibold mr-1">Subject:</span>}
            textareaClassName="font-bold text-slate-900"
            placeholder="Subject line..."
          />
        </div>
      )}

      {/* Salutation */}
      {salutation && (
        <div className="font-semibold text-slate-900 pt-1">
          <EditableBlock
            block={salutation}
            groundingPolicy={groundingPolicy}
            textareaClassName="font-semibold text-slate-900"
            placeholder="Salutation (e.g., Respected Sir/Madam,)..."
          />
        </div>
      )}

      {/* Body Blocks */}
      <div className="space-y-4">
        {bodyBlocks.map((block) => (
          <EditableBlock
            key={block.id}
            block={block}
            groundingPolicy={groundingPolicy}
            textareaClassName="leading-relaxed text-slate-900 text-justify sm:text-left"
            placeholder="Type body paragraph here..."
          />
        ))}
      </div>

      {/* Closing */}
      {closing && (
        <div className="pt-4 max-w-xs font-medium text-slate-800">
          <EditableBlock
            block={closing}
            groundingPolicy={groundingPolicy}
            textareaClassName="font-medium text-slate-800"
            placeholder="Closing (e.g., Yours faithfully,)..."
          />
        </div>
      )}

      {/* Enclosures */}
      {enclosures && (
        <div className="pt-4 text-xs text-slate-600 border-t border-slate-100">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 px-1.5">
            Enclosures:
          </div>
          <EditableBlock
            block={enclosures}
            groundingPolicy={groundingPolicy}
            textareaClassName="text-xs text-slate-600"
            placeholder="Enclosures..."
          />
        </div>
      )}

      {/* Disclaimer block (locked official notice) */}
      {disclaimer && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-500 italic">
          <div className="text-slate-600 font-semibold mb-1">Official Notice</div>
          <EditableBlock
            block={disclaimer}
            groundingPolicy={groundingPolicy}
            readOnly={true}
            textareaClassName="italic text-slate-500 text-xs"
          />
        </div>
      )}
    </div>
  );
};
