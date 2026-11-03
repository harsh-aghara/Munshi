'use client';

import React, { useState } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { getDocTypeById } from '@/config/doctypes';
import { t } from '@/lib/i18n';
import {
  Sparkles,
  Check,
  Edit2,
  ExternalLink,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import type { Fact } from '@/contracts';

export const UnderstandingReview: React.FC = () => {
  const {
    caseState,
    updateFact,
    confirmFact,
    resolveConflict,
    setFocusedEvidenceId,
    focusedEvidenceId,
    prefs,
  } = useMunshiStore();

  const [editingFactKey, setEditingFactKey] = useState<string | null>(null);
  const [factEditValue, setFactEditValue] = useState('');
  const [conflictCustomValue, setConflictCustomValue] = useState<Record<string, string>>({});

  if (!caseState) return null;

  const { facts, missing, docType, docTypeSource, docTypeConfidence } = caseState;
  const docTypeDef = getDocTypeById(docType);

  const startEditFact = (fact: Fact) => {
    setEditingFactKey(fact.key);
    setFactEditValue(fact.value);
  };

  const saveEditFact = (factKey: string) => {
    if (factEditValue.trim()) {
      updateFact(factKey, factEditValue.trim());
    }
    setEditingFactKey(null);
  };

  const handleResolveConflict = (factKey: string, chosenValue: string) => {
    resolveConflict(factKey, chosenValue);
  };

  const handleCustomConflictResolve = (factKey: string) => {
    const customVal = conflictCustomValue[factKey]?.trim();
    if (customVal) {
      resolveConflict(factKey, customVal);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      {/* Header: Understood Type & Confidence */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Writing Type:
          </span>
          <span className="rounded-lg bg-munshi-100 px-2.5 py-1 text-xs font-semibold text-munshi-900">
            {docTypeDef ? t(docTypeDef.labelKey, prefs.uiLang) : docType}
          </span>
        </div>

        {docTypeSource === 'auto' && (
          <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200">
            <Sparkles className="h-3 w-3 text-amber-600" />
            <span>Munshi chose this</span>
            {docTypeConfidence && (
              <span className="font-mono text-[10px] text-amber-600">
                ({Math.round(docTypeConfidence * 100)}%)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Conflicts section (UC5: Speech and doc disagree; never silently picked) */}
      {facts.some((f) => f.status === 'conflict') && (
        <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/70 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <span>{t('capture.conflicts_title', prefs.uiLang)}</span>
          </div>
          <p className="text-[11px] text-rose-700">
            {t('capture.conflict_msg', prefs.uiLang)}
          </p>

          {facts
            .filter((f) => f.status === 'conflict')
            .map((fact) => (
              <div
                key={fact.key}
                className="rounded-lg bg-white p-3 border border-rose-200 text-xs space-y-2 shadow-sm"
              >
                <div className="font-medium text-slate-800">{fact.label}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Current value */}
                  <button
                    type="button"
                    onClick={() => handleResolveConflict(fact.key, fact.value)}
                    className="flex flex-col items-start rounded-lg border border-slate-200 p-2 text-left hover:border-munshi-500 hover:bg-munshi-50 transition-all"
                  >
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">
                      Option A
                    </span>
                    <span className="font-semibold text-slate-900 mt-0.5">{fact.value}</span>
                  </button>

                  {/* Alternative values */}
                  {fact.alternatives?.map((alt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleResolveConflict(fact.key, alt.value)}
                      className="flex flex-col items-start rounded-lg border border-slate-200 p-2 text-left hover:border-munshi-500 hover:bg-munshi-50 transition-all"
                    >
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">
                        Option B
                      </span>
                      <span className="font-semibold text-slate-900 mt-0.5">{alt.value}</span>
                    </button>
                  ))}
                </div>

                {/* Option C: Custom third value */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={conflictCustomValue[fact.key] || ''}
                    onChange={(e) =>
                      setConflictCustomValue({ ...conflictCustomValue, [fact.key]: e.target.value })
                    }
                    placeholder="Or type the correct value..."
                    className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-munshi-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleCustomConflictResolve(fact.key)}
                    className="rounded-md bg-munshi-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-munshi-700"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Extracted Facts List (Linked to Evidence) */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <h4 className="font-semibold text-slate-800 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-munshi-600" />
            {t('capture.facts_title', prefs.uiLang)}
          </h4>
          <span className="text-[10px] text-slate-400">
            {facts.length} fact{facts.length !== 1 ? 's' : ''} extracted
          </span>
        </div>

        {facts.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-center text-xs text-slate-400">
            No facts extracted yet. Speak or type to provide case details.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {facts.map((fact) => {
              const isEditing = editingFactKey === fact.key;
              const hasEvidence = fact.evidenceIds && fact.evidenceIds.length > 0;
              const isEvidenceFocused = fact.evidenceIds.some((id) => id === focusedEvidenceId);

              return (
                <div
                  key={fact.key}
                  className={`flex flex-col gap-1 rounded-xl border p-2 text-xs transition-all ${
                    isEvidenceFocused
                      ? 'border-amber-300 bg-amber-50/50'
                      : fact.status === 'corrected'
                      ? 'border-indigo-100 bg-indigo-50/30'
                      : 'border-slate-100 bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-600">{fact.label}</span>
                    <div className="flex items-center gap-1.5">
                      {fact.status === 'corrected' && (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[9px] font-medium text-indigo-700 border border-indigo-200">
                          Corrected
                        </span>
                      )}

                      {/* Evidence citation link (PRD FE-9, FE-11) */}
                      {hasEvidence && (
                        <button
                          type="button"
                          onClick={() => {
                            const firstEvId = fact.evidenceIds[0];
                            setFocusedEvidenceId(focusedEvidenceId === firstEvId ? null : firstEvId);
                          }}
                          className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                            isEvidenceFocused
                              ? 'bg-amber-200 text-amber-900 font-bold'
                              : 'bg-slate-200/60 text-slate-600 hover:bg-slate-200'
                          }`}
                          title="Show source evidence"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          <span>Evidence</span>
                        </button>
                      )}

                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => startEditFact(fact)}
                          className="rounded p-0.5 text-slate-400 hover:text-slate-700"
                          title="Edit fact"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="text"
                        value={factEditValue}
                        onChange={(e) => setFactEditValue(e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-900 focus:outline-none focus:border-munshi-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => saveEditFact(fact.key)}
                        className="rounded bg-munshi-600 p-1 text-white hover:bg-munshi-700"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="font-semibold text-slate-900 select-text">
                      {fact.value}
                      {fact.previousValue && fact.status === 'corrected' && (
                        <span className="ml-2 text-[10px] font-normal text-slate-400 line-through">
                          {fact.previousValue}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Missing Facts Notice (PRD FE-10) */}
      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-amber-800 mb-1">
            <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
            <span>{t('capture.missing_facts_title', prefs.uiLang)} ({missing.length})</span>
          </div>
          <div className="space-y-1 text-slate-700">
            {missing.map((m) => (
              <div key={m.key} className="flex items-start gap-1.5 text-[11px]">
                <span className="text-amber-600 font-bold">•</span>
                <span>
                  <strong className="text-slate-900">{m.label}:</strong> {m.question}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
