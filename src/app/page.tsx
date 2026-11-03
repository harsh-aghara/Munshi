'use client';

import React from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { SetupBar } from '@/components/SetupBar';
import { CapturePanel } from '@/components/capture/CapturePanel';
import { DocumentPanel } from '@/components/document/DocumentPanel';
import { AccessCodeModal } from '@/components/AccessCodeModal';
import { SendModal } from '@/components/SendModal';
import { LanguageChangeDialog } from '@/components/LanguageChangeDialog';
import { CustomTypeBuilder } from '@/components/CustomTypeBuilder';
import { NewCaseModal } from '@/components/NewCaseModal';
import { StatusNotificationBar } from '@/components/StatusNotificationBar';
import { t } from '@/lib/i18n';
import { Mic, FileText } from 'lucide-react';

export default function Home() {
  const { activePhoneTab, setActivePhoneTab, prefs, draft, rehydrate } = useMunshiStore();

  React.useEffect(() => {
    rehydrate();
  }, [rehydrate]);

  return (
    <main className="min-h-screen flex flex-col bg-slate-50">
      {/* 1. Persistent Setup Bar (PRD FE-1, FE-22) */}
      <SetupBar />

      {/* 2. Mobile Tab Switcher (Visible on small screens, PRD FE-1) */}
      <div className="md:hidden border-b border-slate-200 bg-white px-4 py-2 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setActivePhoneTab('capture')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
            activePhoneTab === 'capture'
              ? 'bg-munshi-600 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Mic className="h-3.5 w-3.5" />
          <span>{t('capture.title', prefs.uiLang)}</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePhoneTab('document')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
            activePhoneTab === 'document'
              ? 'bg-munshi-600 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>{t('document.title', prefs.uiLang)}</span>
          {draft && draft.blocks.length > 0 && (
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          )}
        </button>
      </div>

      {/* 3. Main Two-Panel Layout (Capture Left, Document Right) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden h-[calc(100vh-61px)]">
        {/* Left Panel: Capture */}
        <div
          className={`h-full overflow-y-auto bg-slate-50/50 ${
            activePhoneTab === 'capture' ? 'block' : 'hidden md:block'
          }`}
        >
          <CapturePanel />
        </div>

        {/* Right Panel: Document */}
        <div
          className={`h-full overflow-hidden bg-white ${
            activePhoneTab === 'document' ? 'block' : 'hidden md:block'
          }`}
        >
          <DocumentPanel />
        </div>
      </div>

      {/* 4. Global Modals and Notification Layers */}
      <AccessCodeModal />
      <SendModal />
      <LanguageChangeDialog />
      <CustomTypeBuilder />
      <NewCaseModal />
      <StatusNotificationBar />
    </main>
  );
}
