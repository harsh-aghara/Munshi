'use client';

import React from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { getDocTypeById } from '@/config/doctypes';
import { t } from '@/lib/i18n';
import { Sliders, RefreshCw } from 'lucide-react';
import { MunshiApiClient } from '@/lib/api-client';

export const TypeOptionsForm: React.FC = () => {
  const { caseState, setCaseState, prefs, draft, setDraft, setLoading, setError } =
    useMunshiStore();

  const activeDocTypeId = caseState?.docType || prefs.lastDocType || 'grievance';
  const docTypeDef = getDocTypeById(activeDocTypeId);

  if (!docTypeDef || !docTypeDef.params || docTypeDef.params.length === 0) {
    return null;
  }

  const currentParams = caseState?.params || {};

  const handleParamChange = (key: string, value: string | number | boolean) => {
    setCaseState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        params: {
          ...prev.params,
          [key]: value,
        },
      };
    });
  };

  const handleRegenerate = async () => {
    if (!caseState || !draft) return;

    try {
      setLoading(true, t('document.drafting', prefs.uiLang, { type: docTypeDef.id }));
      setError(null);

      const targetLang =
        prefs.letterLang === 'same'
          ? caseState.inputLang || 'en-IN'
          : prefs.letterLang;

      const newDraft = await MunshiApiClient.streamDraft(
        {
          case: caseState,
          letterLang: targetLang,
          tone: prefs.tone || { id: 'formal' },
          params: caseState.params,
          today: new Date().toISOString().split('T')[0],
          currentDraft: draft,
        },
        (event) => {
          if (event.type === 'block') {
            setDraft({
              ...draft,
              blocks: [...draft.blocks.filter((b) => b.id !== event.block.id), event.block],
            });
          }
        }
      );

      setDraft(newDraft, true);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-munshi-200 bg-munshi-50/70 px-3 py-1.5 text-xs text-slate-800">
      <div className="flex items-center gap-1 font-semibold text-munshi-900">
        <Sliders className="h-3 w-3 text-munshi-700" />
        <span>Options:</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {docTypeDef.params.map((param) => {
          const val =
            currentParams[param.key] !== undefined
              ? currentParams[param.key]
              : (param as any).defaultValue;

          if (param.kind === 'number') {
            return (
              <label key={param.key} className="flex items-center gap-1.5 font-medium">
                <span className="text-slate-600">{t(param.labelKey, prefs.uiLang)}:</span>
                <input
                  type="number"
                  min={param.min}
                  max={param.max}
                  value={Number(val) || ''}
                  onChange={(e) => handleParamChange(param.key, Number(e.target.value))}
                  className="w-16 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs shadow-sm focus:border-munshi-500 focus:outline-none"
                />
              </label>
            );
          }

          if (param.kind === 'select' && param.options) {
            return (
              <label key={param.key} className="flex items-center gap-1.5 font-medium">
                <span className="text-slate-600">{t(param.labelKey, prefs.uiLang)}:</span>
                <select
                  value={String(val || '')}
                  onChange={(e) => handleParamChange(param.key, e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs shadow-sm focus:border-munshi-500 focus:outline-none"
                >
                  {param.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.labelKey, prefs.uiLang)}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (param.kind === 'toggle') {
            return (
              <label key={param.key} className="flex items-center gap-1.5 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(val)}
                  onChange={(e) => handleParamChange(param.key, e.target.checked)}
                  className="rounded border-slate-300 text-munshi-600 focus:ring-munshi-500 h-3.5 w-3.5"
                />
                <span className="text-slate-700">{t(param.labelKey, prefs.uiLang)}</span>
              </label>
            );
          }

          return (
            <label key={param.key} className="flex items-center gap-1.5 font-medium">
              <span className="text-slate-600">{t(param.labelKey, prefs.uiLang)}:</span>
              <input
                type="text"
                value={String(val || '')}
                onChange={(e) => handleParamChange(param.key, e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs shadow-sm focus:border-munshi-500 focus:outline-none"
              />
            </label>
          );
        })}
      </div>

      {draft && (
        <button
          type="button"
          onClick={handleRegenerate}
          className="ml-auto flex items-center gap-1 rounded-md bg-white border border-munshi-300 px-2 py-0.5 text-[11px] font-medium text-munshi-800 shadow-sm hover:bg-munshi-100 hover:text-munshi-900 transition-colors"
        >
          <RefreshCw className="h-2.5 w-2.5" />
          <span>{t('setup.regenerate', prefs.uiLang)}</span>
        </button>
      )}
    </div>
  );
};
