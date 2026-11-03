'use client';

import React from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import type { DraftBlock } from '@/contracts';
import { Mail, AlertTriangle, FileText, Lock } from 'lucide-react';

interface EmailLayoutProps {
  blocks: DraftBlock[];
  groundingPolicy: 'strict' | 'facts' | 'creative';
}

export const EmailLayout: React.FC<EmailLayoutProps> = ({
  blocks,
  groundingPolicy,
}) => {
  const { contacts, focusedEvidenceId, setFocusedEvidenceId, currentTTSBlockId } =
    useMunshiStore();

  const getBlock = (role: string) => blocks.find((b) => b.role === role);
  const getBlocks = (role: string) => blocks.filter((b) => b.role === role);

  const subject = getBlock('subject');
  const salutation = getBlock('salutation');
  const bodyBlocks = getBlocks('body');
  const closing = getBlock('closing');
  const recipientEmail = contacts[0]?.email || 'recipient@example.com';

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
        <p className="whitespace-pre-line leading-relaxed text-slate-900">{block.text}</p>

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
    <div className="layout-email mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
      {/* Email Header Card */}
      <div className="border-b border-slate-200 bg-slate-50/80 p-4 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-12 font-semibold text-slate-400 uppercase tracking-wider">To:</span>
          <span className="font-mono font-medium text-slate-800">{recipientEmail}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-12 font-semibold text-slate-400 uppercase tracking-wider">Subject:</span>
          <span className="font-bold text-slate-900 text-sm">
            {subject ? subject.text : '(No subject)'}
          </span>
        </div>
      </div>

      {/* Email Body Area */}
      <div className="p-6 space-y-4 text-sm leading-relaxed text-slate-900">
        {salutation && <div className="font-semibold">{renderBlockWithGrounding(salutation)}</div>}

        <div className="space-y-3">
          {bodyBlocks.map((b) => renderBlockWithGrounding(b))}
        </div>

        {closing && <div className="pt-4 font-medium">{renderBlockWithGrounding(closing)}</div>}
      </div>
    </div>
  );
};
