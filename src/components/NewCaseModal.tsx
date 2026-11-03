'use client';

import React from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { t } from '@/lib/i18n';
import { RotateCcw, AlertTriangle, X } from 'lucide-react';

export const NewCaseModal: React.FC = () => {
  const { showNewCaseModal, setShowNewCaseModal, resetNewCase, prefs } = useMunshiStore();

  if (!showNewCaseModal) return null;

  const handleConfirm = () => {
    resetNewCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 modal-backdrop">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-munshi-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {t('app.new_case', prefs.uiLang)}
          </h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {t('app.new_case_confirm', prefs.uiLang)}
        </p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowNewCaseModal(false)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t('app.cancel', prefs.uiLang)}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-soft hover:bg-red-700 active:scale-95 transition-all"
          >
            {t('app.confirm', prefs.uiLang)}
          </button>
        </div>
      </div>
    </div>
  );
};
