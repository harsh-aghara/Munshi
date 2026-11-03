'use client';

import React from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import type { DraftBlock } from '@/contracts';
import { EditableBlock } from './EditableBlock';

interface EmailLayoutProps {
  blocks: DraftBlock[];
  groundingPolicy: 'strict' | 'facts' | 'creative';
}

export const EmailLayout: React.FC<EmailLayoutProps> = ({
  blocks,
  groundingPolicy,
}) => {
  const { contacts } = useMunshiStore();

  const getBlock = (role: string) => blocks.find((b) => b.role === role);
  const getBlocks = (role: string) => blocks.filter((b) => b.role === role);

  const subject = getBlock('subject');
  const salutation = getBlock('salutation');
  const bodyBlocks = getBlocks('body');
  const closing = getBlock('closing');
  const recipientEmail = contacts[0]?.email || 'recipient@example.com';

  return (
    <div className="layout-email mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
      {/* Email Header Card */}
      <div className="border-b border-slate-200 bg-slate-50/80 p-4 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-16 font-semibold text-slate-400 uppercase tracking-wider">To:</span>
          <span className="font-mono font-medium text-slate-800">{recipientEmail}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-16 font-semibold text-slate-400 uppercase tracking-wider pt-1.5">Subject:</span>
          <div className="flex-1 font-bold text-slate-900 text-sm">
            {subject ? (
              <EditableBlock
                block={subject}
                groundingPolicy={groundingPolicy}
                textareaClassName="font-bold text-slate-900 text-sm"
                placeholder="Email Subject..."
              />
            ) : (
              <span className="text-slate-400 italic">(No subject)</span>
            )}
          </div>
        </div>
      </div>

      {/* Email Body Area */}
      <div className="p-6 space-y-4 text-sm leading-relaxed text-slate-900">
        {salutation && (
          <div className="font-semibold">
            <EditableBlock
              block={salutation}
              groundingPolicy={groundingPolicy}
              textareaClassName="font-semibold text-slate-900"
              placeholder="Salutation (e.g., Dear Team,)..."
            />
          </div>
        )}

        <div className="space-y-3">
          {bodyBlocks.map((b) => (
            <EditableBlock
              key={b.id}
              block={b}
              groundingPolicy={groundingPolicy}
              textareaClassName="leading-relaxed text-slate-900"
              placeholder="Type email body..."
            />
          ))}
        </div>

        {closing && (
          <div className="pt-4 font-medium">
            <EditableBlock
              block={closing}
              groundingPolicy={groundingPolicy}
              textareaClassName="font-medium text-slate-800"
              placeholder="Sign off (e.g., Best regards,)..."
            />
          </div>
        )}
      </div>
    </div>
  );
};
