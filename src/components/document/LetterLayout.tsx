'use client';

import React from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import type { DraftBlock } from '@/contracts';
import {
  AlertTriangle,
  Lock,
  Volume2,
  FileText,
  MessageSquare,
} from 'lucide-react';

interface LetterLayoutProps {
  blocks: DraftBlock[];
  groundingPolicy: 'strict' | 'facts' | 'creative';
}

export const LetterLayout: React.FC<LetterLayoutProps> = ({
  blocks,
  groundingPolicy,
}) => {
  const { focusedEvidenceId, setFocusedEvidenceId, currentTTSBlockId } = useMunshiStore();

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

  const renderBlockWithGrounding = (block: DraftBlock, className = '') => {
    const isPlaying = currentTTSBlockId === block.id;
    const isUnverified = block.grounding === 'unverified';

    return (
      <div
        key={block.id}
        className={`group relative rounded-lg p-1.5 transition-all ${
          isPlaying
            ? 'bg-amber-100/70 ring-2 ring-amber-400'
            : 'hover:bg-slate-50/70'
        } ${className}`}
      >
        <p className="whitespace-pre-line leading-relaxed text-slate-900">{block.text}</p>

        {/* Provenance & Grounding Chips (PRD FE-13) */}
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

            {block.locked && (
              <span className="flex items-center gap-0.5 text-[9px] text-slate-400">
                <Lock className="h-2.5 w-2.5" /> Locked
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="layout-letter mx-auto max-w-3xl space-y-6 text-sm text-slate-900 leading-relaxed font-normal">
      {/* Sender and Date row */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-100 pb-4">
        {sender && (
          <div className="font-medium text-slate-700 max-w-xs">
            {renderBlockWithGrounding(sender)}
          </div>
        )}
        {date && (
          <div className="sm:text-right font-medium text-slate-600 ml-auto">
            {renderBlockWithGrounding(date)}
          </div>
        )}
      </div>

      {/* Recipient */}
      {recipient && (
        <div className="max-w-md font-medium text-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
            To:
          </div>
          {renderBlockWithGrounding(recipient)}
        </div>
      )}

      {/* Subject Line */}
      {subject && (
        <div className="rounded-lg bg-slate-50 p-2 border-l-4 border-munshi-600 font-bold text-slate-900">
          <span className="text-slate-500 font-semibold mr-1">Subject:</span>
          {subject.text}
        </div>
      )}

      {/* Salutation */}
      {salutation && (
        <div className="font-semibold text-slate-900 pt-1">
          {renderBlockWithGrounding(salutation)}
        </div>
      )}

      {/* Body Blocks */}
      <div className="space-y-4">
        {bodyBlocks.map((block) => renderBlockWithGrounding(block))}
      </div>

      {/* Closing */}
      {closing && (
        <div className="pt-4 max-w-xs font-medium text-slate-800">
          {renderBlockWithGrounding(closing)}
        </div>
      )}

      {/* Enclosures */}
      {enclosures && (
        <div className="pt-4 text-xs text-slate-600 border-t border-slate-100">
          <span className="font-semibold uppercase tracking-wider text-slate-400">
            Enclosures:
          </span>
          {renderBlockWithGrounding(enclosures)}
        </div>
      )}

      {/* Disclaimer block (PRD BE-13, NFR-6: Legal-style types, locked, cannot be removed) */}
      {disclaimer && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 italic">
          <div className="flex items-center gap-1.5 font-semibold not-italic text-slate-600 mb-0.5">
            <Lock className="h-3 w-3 text-slate-400" />
            <span>Official Notice</span>
          </div>
          <p>{disclaimer.text}</p>
        </div>
      )}
    </div>
  );
};
