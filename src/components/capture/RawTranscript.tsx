'use client';

import React, { useEffect, useRef } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { t } from '@/lib/i18n';
import { FileText, MessageSquareQuote } from 'lucide-react';
import type { Segment } from '@/contracts';

interface RawTranscriptProps {
  segments: Segment[];
}

export const RawTranscript: React.FC<RawTranscriptProps> = ({ segments }) => {
  const { prefs, focusedEvidenceId, setFocusedEvidenceId } = useMunshiStore();
  const highlightedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to highlighted segment
  useEffect(() => {
    if (focusedEvidenceId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusedEvidenceId]);

  if (!segments || segments.length === 0) {
    return null;
  }

  // Check if multiple languages are present across segments
  const uniqueLangs = new Set(segments.map((s) => s.lang));
  const showLangTags = uniqueLangs.size > 1;

  const formatMs = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
          <MessageSquareQuote className="h-3.5 w-3.5 text-munshi-600" />
          {t('capture.transcript_title', prefs.uiLang)}
        </h3>
        <span className="text-[10px] text-slate-400">
          {segments.length} segment{segments.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {segments.map((seg) => {
          const isFocused = focusedEvidenceId === seg.id;

          return (
            <div
              key={seg.id}
              ref={isFocused ? highlightedRef : null}
              onClick={() => setFocusedEvidenceId(isFocused ? null : seg.id)}
              className={`cursor-pointer rounded-xl p-2.5 text-xs transition-all ${
                isFocused
                  ? 'bg-amber-100/80 border border-amber-300 ring-2 ring-amber-400/30 font-medium'
                  : 'bg-slate-50 border border-slate-100 hover:bg-slate-100 text-slate-800'
              }`}
            >
              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-mono">
                  {formatMs(seg.startMs)} – {formatMs(seg.endMs)}
                </span>
                {showLangTags && (
                  <span className="rounded bg-slate-200/70 px-1.5 py-0.2 font-mono text-[9px] uppercase text-slate-600">
                    {seg.lang}
                  </span>
                )}
              </div>
              <p className="leading-relaxed select-text">{seg.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
