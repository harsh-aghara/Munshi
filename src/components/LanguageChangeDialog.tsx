'use client';

import React from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { MunshiApiClient } from '@/lib/api-client';
import { getLanguageByCode } from '@/config/languages';
import { getDocTypeById } from '@/config/doctypes';
import { t } from '@/lib/i18n';
import {
  Languages,
  Sparkles,
  Repeat,
  X,
  Loader2,
  FileCheck,
} from 'lucide-react';

export const LanguageChangeDialog: React.FC = () => {
  const {
    showLangChangeDialog,
    setShowLangChangeDialog,
    draft,
    setDraft,
    caseState,
    prefs,
    setPrefs,
    setLoading,
    setError,
  } = useMunshiStore();

  if (!showLangChangeDialog || !draft) return null;

  const { targetLang } = showLangChangeDialog;
  const targetLangDef = getLanguageByCode(targetLang);
  const targetLangLabel = targetLangDef ? targetLangDef.label : targetLang;

  const docTypeDef = getDocTypeById(draft.docType);
  const isCreative = docTypeDef?.grounding === 'creative';

  // Option 1: Translate this draft (POST /api/translate)
  const handleTranslate = async () => {
    setShowLangChangeDialog(null);
    try {
      setLoading(true, `Translating document to ${targetLangLabel}...`);
      setError(null);

      const translated = await MunshiApiClient.translateDraft(draft, targetLang);
      setDraft(translated, true);
      setPrefs({ letterLang: targetLang });
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Option 2: Rewrite in this language (POST /api/draft with mode: 'rewrite')
  const handleRewrite = async () => {
    if (!caseState) return;
    setShowLangChangeDialog(null);

    try {
      setLoading(true, `Rewriting document in ${targetLangLabel}...`);
      setError(null);

      const newDraft = await MunshiApiClient.streamDraft(
        {
          case: caseState,
          letterLang: targetLang,
          tone: prefs.tone || { id: 'formal' },
          params: caseState.params,
          today: new Date().toISOString().split('T')[0],
          mode: 'rewrite',
          currentDraft: draft,
        },
        () => {}
      );

      setDraft(newDraft, true);
      setPrefs({ letterLang: targetLang });
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 modal-backdrop">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-munshi-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-munshi-100 text-munshi-700">
              <Languages className="h-5 w-5" />
            </span>
            <h3 className="text-base font-bold text-slate-900">
              {t('lang_change.title', prefs.uiLang)}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowLangChangeDialog(null)}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-600">
          {t('lang_change.prompt', prefs.uiLang, { lang: targetLangLabel })}
        </p>

        <div className="mt-5 space-y-3">
          {/* Button A: Translate Draft */}
          <button
            type="button"
            onClick={handleTranslate}
            className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-soft hover:border-munshi-500 hover:bg-munshi-50/50 active:scale-[0.99] transition-all"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 mt-0.5">
              <Repeat className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-900">
                {t('lang_change.translate', prefs.uiLang)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {t('lang_change.translate_desc', prefs.uiLang)}
              </div>
            </div>
          </button>

          {/* Button B: Rewrite in this Language */}
          <button
            type="button"
            onClick={handleRewrite}
            className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left shadow-soft active:scale-[0.99] transition-all ${
              isCreative
                ? 'border-munshi-500 bg-munshi-50 ring-2 ring-munshi-500/20'
                : 'border-slate-200 bg-white hover:border-munshi-500 hover:bg-munshi-50/50'
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-munshi-100 text-munshi-700 mt-0.5">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <span>{t('lang_change.rewrite', prefs.uiLang)}</span>
                {isCreative && (
                  <span className="rounded bg-munshi-200/80 px-1.5 py-0.2 text-[9px] font-semibold text-munshi-900">
                    Recommended for creative
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {t('lang_change.rewrite_desc', prefs.uiLang)}
              </div>
            </div>
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setShowLangChangeDialog(null)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            {t('app.cancel', prefs.uiLang)}
          </button>
        </div>
      </div>
    </div>
  );
};
