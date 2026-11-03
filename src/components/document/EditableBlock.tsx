'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { getLanguageByCode } from '@/config/languages';
import type { DraftBlock } from '@/contracts';
import { AlertTriangle, FileText, Lock, Pencil } from 'lucide-react';

interface EditableBlockProps {
  block: DraftBlock;
  className?: string;
  textareaClassName?: string;
  groundingPolicy?: 'strict' | 'facts' | 'creative';
  placeholder?: string;
  prefix?: React.ReactNode;
  readOnly?: boolean;
}

export const EditableBlock: React.FC<EditableBlockProps> = ({
  block,
  className = '',
  textareaClassName = '',
  groundingPolicy = 'facts',
  placeholder = 'Type to edit...',
  prefix,
  readOnly = false,
}) => {
  const {
    draft,
    currentTTSBlockId,
    focusedEvidenceId,
    setFocusedEvidenceId,
    updateDraftBlock,
    commitDraftBlockEdit,
  } = useMunshiStore();

  const [text, setText] = useState(block.text);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const langDef = getLanguageByCode(draft?.lang || 'en-IN');
  const isPlaying = currentTTSBlockId === block.id;
  const isUnverified = block.grounding === 'unverified';
  const isLocked = block.locked || readOnly;

  // Sync external text changes (e.g. from LLM streaming, tone changes, translations)
  useEffect(() => {
    setText(block.text);
  }, [block.text]);

  // Dynamic auto-resize for textarea height to fit content perfectly without scrollbars
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
  };

  useEffect(() => {
    autoResize();
  }, [text, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    updateDraftBlock(block.id, newText);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    commitDraftBlockEdit(block.id, text);
  };

  const fontFamilyStyle = langDef?.fontFamily
    ? { fontFamily: langDef.fontFamily }
    : undefined;

  if (isLocked) {
    return (
      <div
        className={`group relative rounded-xl p-2 transition-all ${
          isPlaying ? 'bg-amber-100/70 ring-2 ring-amber-400' : ''
        } ${className}`}
      >
        <div className="flex items-start gap-1.5 text-slate-500">
          <Lock className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
          <p
            dir="auto"
            style={fontFamilyStyle}
            className={`whitespace-pre-line leading-relaxed text-slate-800 ${textareaClassName}`}
          >
            {text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative rounded-xl transition-all ${
        isPlaying
          ? 'bg-amber-100/70 ring-2 ring-amber-400 p-1.5'
          : isFocused
          ? 'bg-white ring-2 ring-munshi-500/20 border border-munshi-400 shadow-soft-sm p-1.5'
          : 'hover:bg-slate-50/80 hover:ring-1 hover:ring-slate-200/80 p-1.5'
      } ${className}`}
    >
      {/* Print-only clean vector paragraph (zero textarea scrollbar artifacts in PDF) */}
      <div className="hidden print:block">
        {prefix}
        <p
          dir="auto"
          style={fontFamilyStyle}
          className={`whitespace-pre-line leading-relaxed text-slate-900 ${textareaClassName}`}
        >
          {text}
        </p>
      </div>

      {/* Screen interactive in-place editor */}
      <div className="print:hidden">
        <div className="flex items-start gap-1">
          {prefix && <div className="shrink-0 select-none pt-0.5">{prefix}</div>}
          <div className="relative w-full">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              dir="auto"
              spellCheck={false}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={placeholder}
              style={fontFamilyStyle}
              className={`w-full resize-none overflow-hidden bg-transparent border-0 p-0 text-slate-900 focus:outline-none focus:ring-0 leading-relaxed placeholder:text-slate-300 transition-colors ${textareaClassName}`}
            />
            {/* Subtle pencil badge visible on hover when not focused */}
            {!isFocused && (
              <span className="pointer-events-none absolute right-1 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-200/80 shadow-xs">
                <Pencil className="h-2.5 w-2.5 text-slate-400" />
                <span>Edit</span>
              </span>
            )}
          </div>
        </div>

        {/* Provenance & Grounding Chips */}
        {groundingPolicy !== 'creative' && (
          <div
            className={`mt-1 flex flex-wrap items-center gap-1.5 transition-opacity ${
              isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {block.evidenceIds.map((evId) => (
              <button
                key={evId}
                type="button"
                onClick={() =>
                  setFocusedEvidenceId(focusedEvidenceId === evId ? null : evId)
                }
                className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                  focusedEvidenceId === evId
                    ? 'bg-munshi-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
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
    </div>
  );
};
