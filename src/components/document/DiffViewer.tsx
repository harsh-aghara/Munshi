'use client';

import React from 'react';
import { computeWordDiff, DiffToken } from '@/lib/diff';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  onClose?: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ oldText, newText, onClose }) => {
  const diffTokens: DiffToken[] = computeWordDiff(oldText, newText);

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3 shadow-soft">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-indigo-900">
            Version Change Diff
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-700">Added</span>
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500 ml-1" />
            <span className="text-rose-700">Removed</span>
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-slate-400 hover:text-slate-700 font-medium"
          >
            Hide diff
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
        {diffTokens.map((token, i) => {
          if (token.type === 'added') {
            return (
              <span
                key={i}
                className="bg-emerald-100 text-emerald-900 font-medium px-0.5 rounded"
              >
                {token.value}
              </span>
            );
          }
          if (token.type === 'removed') {
            return (
              <span
                key={i}
                className="bg-rose-100 text-rose-900 line-through px-0.5 rounded opacity-75"
              >
                {token.value}
              </span>
            );
          }
          return <span key={i}>{token.value}</span>;
        })}
      </div>
    </div>
  );
};
