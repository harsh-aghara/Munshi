'use client';

import React, { useState } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { getDocTypeById } from '@/config/doctypes';
import { LetterLayout } from './LetterLayout';
import { EmailLayout } from './EmailLayout';
import { ProseLayout } from './ProseLayout';
import { VerseLayout } from './VerseLayout';
import { CommandBar } from './CommandBar';
import { DiffViewer } from './DiffViewer';
import { exportToPdf } from '@/lib/pdf';
import { MunshiApiClient } from '@/lib/api-client';
import { globalAudioPlayer } from '@/lib/audio';
import { t } from '@/lib/i18n';
import {
  FileText,
  Volume2,
  Square,
  Copy,
  Check,
  Printer,
  Send,
  Undo2,
  Redo2,
  PenTool,
  Languages,
  Eye,
  GitCompare,
  Sparkles,
} from 'lucide-react';

export const DocumentPanel: React.FC = () => {
  const {
    draft,
    draftHistory,
    draftHistoryIndex,
    undoDraft,
    redoDraft,
    prefs,
    setPrefs,
    isPlayingTTS,
    setIsPlayingTTS,
    setShowSendModal,
    setShowLangChangeDialog,
    caseState,
    setDraft,
    setLoading,
    setError,
  } = useMunshiStore();

  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [translatedDraft, setTranslatedDraft] = useState<typeof draft | null>(null);
  const [showTranslatedSideBySide, setShowTranslatedSideBySide] = useState(false);

  const activeDocTypeId = draft?.docType || caseState?.docType || prefs.lastDocType || 'grievance';
  const docTypeDef = getDocTypeById(activeDocTypeId);
  const groundingPolicy = docTypeDef?.grounding || 'facts';
  const isSendable = docTypeDef?.sendable || false;

  // Copy full document text
  const handleCopyText = async () => {
    if (!draft) return;
    const fullText = draft.blocks.map((b) => b.text).join('\n\n');
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy to clipboard failed', e);
    }
  };

  // PDF Export
  React.useEffect(() => {
    return () => {
      globalAudioPlayer.stop();
    };
  }, []);

  const handleExportPdf = () => {
    if (!draft) return;
    exportToPdf(draft.layout, draft.lang);
  };

  // Read-Aloud (Bulbul TTS sequential playback with instant stop support)
  const handleToggleReadAloud = async () => {
    if (isPlayingTTS) {
      globalAudioPlayer.stop();
      setIsPlayingTTS(false, null);
      return;
    }

    if (!draft || draft.blocks.length === 0) return;

    globalAudioPlayer.stop();
    setIsPlayingTTS(true);

    try {
      for (const block of draft.blocks) {
        if (!block.text.trim()) continue;
        if (!useMunshiStore.getState().isPlayingTTS) break;

        setIsPlayingTTS(true, block.id);
        const audioChunks = await MunshiApiClient.textToSpeech(block.text, draft.lang);

        if (!useMunshiStore.getState().isPlayingTTS) break;

        const finished = await globalAudioPlayer.playBase64Chunks(audioChunks);
        if (!finished || !useMunshiStore.getState().isPlayingTTS) break;
      }
    } catch (e) {
      console.warn('TTS playback error', e);
    } finally {
      globalAudioPlayer.stop();
      setIsPlayingTTS(false, null);
    }
  };

  // Quick tone change from Tone Chip (PRD FE-24)
  const handleToneChipChange = async (toneId: string) => {
    if (!draft || !caseState) return;

    try {
      setLoading(true, `Regenerating style with ${toneId} tone...`);
      setPrefs({ tone: { id: toneId } });

      const targetLang =
        prefs.letterLang === 'same'
          ? caseState.inputLang || 'en-IN'
          : prefs.letterLang;

      const newDraft = await MunshiApiClient.streamDraft(
        {
          case: caseState,
          letterLang: targetLang,
          tone: { id: toneId },
          params: caseState.params,
          today: new Date().toISOString().split('T')[0],
          toneChange: { id: toneId },
          currentDraft: draft,
        },
        () => {}
      );

      setDraft(newDraft, true);
      setShowDiff(true); // Auto-show diff per FE-15, FE-24
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Render appropriate layout
  const renderLayout = (blocksToRender: typeof draft extends null ? never : any) => {
    const layout = draft?.layout || docTypeDef?.layout || 'letter';

    switch (layout) {
      case 'letter':
        return <LetterLayout blocks={blocksToRender} groundingPolicy={groundingPolicy} />;
      case 'email':
        return <EmailLayout blocks={blocksToRender} groundingPolicy={groundingPolicy} />;
      case 'verse':
        return <VerseLayout blocks={blocksToRender} groundingPolicy={groundingPolicy} />;
      case 'prose':
      default:
        return <ProseLayout blocks={blocksToRender} groundingPolicy={groundingPolicy} />;
    }
  };

  const previousDraft =
    draftHistoryIndex > 0 ? draftHistory[draftHistoryIndex - 1] : null;

  return (
    <div id="document-panel" className="flex flex-col h-full bg-slate-50/50">
      {/* Persistent Document Toolbar */}
      <div
        id="document-toolbar"
        className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white p-3 px-4 shadow-soft-sm"
      >
        {/* Left: Tone Chip, Language Chip, Undo/Redo, Version */}
        <div className="flex flex-wrap items-center gap-2">
          {draft && (
            <>
              {/* Tone Chip */}
              <div className="flex items-center gap-1 rounded-xl bg-munshi-50 px-2.5 py-1 text-xs font-semibold text-munshi-900 border border-munshi-200">
                <PenTool className="h-3 w-3 text-munshi-600" />
                <span>
                  {prefs.tone && 'custom' in prefs.tone
                    ? prefs.tone.custom
                    : prefs.tone && 'id' in prefs.tone
                    ? t(`tone.${prefs.tone.id}`, prefs.uiLang)
                    : 'Formal'}
                </span>
              </div>

              {/* Document Language Chip */}
              <button
                type="button"
                onClick={() => setShowLangChangeDialog({ targetLang: draft.lang })}
                className="flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors"
                title="Change document language"
              >
                <Languages className="h-3 w-3 text-slate-500" />
                <span className="uppercase font-mono text-[11px]">{draft.lang}</span>
              </button>

              {/* Version & Undo / Redo (PRD FE-15) */}
              <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                <button
                  type="button"
                  disabled={draftHistoryIndex <= 0}
                  onClick={undoDraft}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  title="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={draftHistoryIndex >= draftHistory.length - 1}
                  onClick={redoDraft}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  title="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                </button>
                <span className="text-[11px] font-mono text-slate-400 ml-1">
                  v{draftHistoryIndex + 1}
                </span>
              </div>

              {/* Diff toggle button */}
              {previousDraft && (
                <button
                  type="button"
                  onClick={() => setShowDiff(!showDiff)}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium border transition-colors ${
                    showDiff
                      ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  <span>{showDiff ? 'Hide Diff' : 'Show Diff'}</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Right: Read Aloud, Export PDF, Copy, Send Handoff */}
        <div className="flex items-center gap-2">
          {draft && (
            <>
              {/* Read Aloud Button */}
              <button
                type="button"
                onClick={handleToggleReadAloud}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isPlayingTTS
                    ? 'border-amber-400 bg-amber-50 text-amber-800 animate-pulse'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {isPlayingTTS ? (
                  <>
                    <Square className="h-3.5 w-3.5" />
                    <span>{t('document.stop_reading', prefs.uiLang)}</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-slate-600" />
                    <span>{t('document.read_aloud', prefs.uiLang)}</span>
                  </>
                )}
              </button>

              {/* Copy Text */}
              <button
                type="button"
                onClick={handleCopyText}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                title="Copy text to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700">{t('document.copied', prefs.uiLang)}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t('document.copy', prefs.uiLang)}</span>
                  </>
                )}
              </button>

              {/* Export PDF */}
              <button
                type="button"
                onClick={handleExportPdf}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                title="Export as PDF"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{t('document.export_pdf', prefs.uiLang)}</span>
              </button>

              {/* Send / Mail Handoff (Only for sendable types per PRD FE-19) */}
              {isSendable ? (
                <button
                  type="button"
                  onClick={() => setShowSendModal(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-munshi-600 px-4 py-1.5 text-xs font-semibold text-white shadow-soft hover:bg-munshi-700 active:scale-95 transition-all"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{t('document.send', prefs.uiLang)}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSendModal(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  title="Email draft with blank recipient"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Email</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Document Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        {!draft || draft.blocks.length === 0 ? (
          /* Empty State */
          <div className="flex h-full min-h-[350px] flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 mb-3 shadow-inner">
              <FileText className="h-8 w-8" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">
              Ready to write your {docTypeDef ? t(docTypeDef.labelKey, prefs.uiLang) : 'document'}
            </h3>
            <p className="max-w-sm text-xs text-slate-400 mt-1">
              {t('document.empty_state', prefs.uiLang)}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Word Diff Viewer if toggled */}
            {showDiff && previousDraft && (
              <DiffViewer
                oldText={previousDraft.blocks.map((b) => b.text).join('\n\n')}
                newText={draft.blocks.map((b) => b.text).join('\n\n')}
                onClose={() => setShowDiff(false)}
              />
            )}

            {/* Document Render Area (Paper preview) */}
            <div
              id="munshi-document-preview"
              className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-12 shadow-soft-lg min-h-[500px]"
            >
              {renderLayout(draft.blocks)}
            </div>
          </div>
        )}
      </div>

      {/* Command Bar at bottom (PRD FE-14) */}
      <CommandBar />
    </div>
  );
};
