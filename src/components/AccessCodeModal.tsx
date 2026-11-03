'use client';

import React, { useState } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { t } from '@/lib/i18n';
import { KeyRound, Lock, AlertCircle } from 'lucide-react';

export const AccessCodeModal: React.FC = () => {
  const { accessCode, isAccessDenied, setAccessCode, prefs } = useMunshiStore();
  const [inputCode, setInputCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // If we already have an access code and it's not denied, don't show modal
  if (accessCode && !isAccessDenied) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputCode.trim();
    if (!trimmed) {
      setErrorMsg('Please enter an access code.');
      return;
    }
    setErrorMsg('');
    setAccessCode(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 modal-backdrop">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-munshi-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-munshi-100 text-munshi-700">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {t('app.access_code', prefs.uiLang)}
            </h2>
            <p className="text-sm text-slate-500">
              {t('app.enter_access_code', prefs.uiLang)}
            </p>
          </div>
        </div>

        {isAccessDenied && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{t('error.ACCESS_DENIED', prefs.uiLang)}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 text-sm text-red-600">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="access-code" className="sr-only">
              {t('app.access_code', prefs.uiLang)}
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <input
                id="access-code"
                type="password"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Enter access code..."
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-slate-900 shadow-sm focus:border-munshi-500 focus:outline-none focus:ring-2 focus:ring-munshi-500/20 text-sm"
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-munshi-600 py-2.5 px-4 text-sm font-medium text-white shadow hover:bg-munshi-700 focus:outline-none focus:ring-2 focus:ring-munshi-500/20 active:scale-[0.98] transition-all"
          >
            {t('app.submit', prefs.uiLang)}
          </button>
        </form>
      </div>
    </div>
  );
};
