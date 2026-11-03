'use client';

import React from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { t } from '@/lib/i18n';
import { Loader2, AlertCircle, RefreshCw, X } from 'lucide-react';

export const StatusNotificationBar: React.FC = () => {
  const { isLoading, loadingMessage, error, setError, prefs } = useMunshiStore();

  if (!isLoading && !error) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4 pointer-events-none">
      {/* Loading state with progress message (PRD FE-3, NFR-7) */}
      {isLoading && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-slate-900/90 text-white px-4 py-3 shadow-2xl backdrop-blur-md border border-slate-700/50 animate-in fade-in slide-in-from-bottom-2 pointer-events-auto">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-munshi-400" />
          <span className="text-xs font-medium truncate">
            {loadingMessage || t('app.loading', prefs.uiLang)}
          </span>
        </div>
      )}

      {/* Error state with retryable flag and dismiss (PRD FE-3) */}
      {error && !isLoading && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-red-600 text-white px-4 py-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 pointer-events-auto">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-200" />
            <span className="text-xs font-medium truncate">
              {error.message || t(`error.${error.code}`, prefs.uiLang) || 'An error occurred'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {error.retryable && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  window.location.reload();
                }}
                className="flex items-center gap-1 rounded-lg bg-red-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-800"
              >
                <RefreshCw className="h-3 w-3" />
                <span>{t('app.retry', prefs.uiLang)}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-lg p-1 text-red-200 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
