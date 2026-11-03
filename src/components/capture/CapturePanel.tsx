'use client';

import React, { useState } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { VoiceRecorderWidget } from './VoiceRecorder';
import { DocumentUpload } from './DocumentUpload';
import { RawTranscript } from './RawTranscript';
import { FieldChips } from './FieldChips';
import { UnderstandingReview } from './UnderstandingReview';
import { FollowUpCard } from './FollowUpCard';
import { TypeOptionsForm } from '../TypeOptionsForm';
import { getDocTypeById } from '@/config/doctypes';
import { MunshiApiClient } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import {
  Sparkles,
  PenLine,
  Send,
  Loader2,
  FileCheck,
  FileText,
  AlertCircle,
} from 'lucide-react';
import type { CaseDoc, Contact, Draft, Fact, Segment } from '@/contracts';

export const CapturePanel: React.FC = () => {
  const {
    caseState,
    setCaseState,
    draft,
    setDraft,
    prefs,
    setLoading,
    setError,
    setActivePhoneTab,
  } = useMunshiStore();

  const [typedNotes, setTypedNotes] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);

  const activeDocTypeId = caseState?.docType || prefs.lastDocType || 'grievance';
  const docTypeDef = getDocTypeById(activeDocTypeId);
  const uploadMode = docTypeDef?.documentUpload || 'optional';

  // Handler when voice transcript finishes
  const handleTranscriptionComplete = async (newSegments: Segment[]) => {
    const existingSegments = caseState?.segments || [];
    const allSegments = [...existingSegments, ...newSegments];

    // Main dictation language
    const inputLang =
      newSegments[0]?.lang || caseState?.inputLang || (prefs.dictationLang === 'auto' ? 'hi-IN' : prefs.dictationLang);

    try {
      setLoading(true, t('capture.extracting_facts', prefs.uiLang));
      const updatedCaseState = await MunshiApiClient.understand({
        docTypeId: activeDocTypeId,
        customBrief: caseState?.customBrief,
        params: caseState?.params || {},
        segments: allSegments,
        docs: caseState?.docs || [],
        inputLang,
        previousCase: caseState || undefined,
      });

      setCaseState(updatedCaseState);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Handler for typed notes submission (Typed fallback)
  const handleTypedNotesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = typedNotes.trim();
    if (!text) return;

    const newSegment: Segment = {
      id: `seg_${Date.now()}`,
      startMs: 0,
      endMs: 0,
      text,
      lang: prefs.dictationLang === 'auto' ? 'en-IN' : prefs.dictationLang,
    };

    const allSegments = [...(caseState?.segments || []), newSegment];
    setTypedNotes('');

    try {
      setLoading(true, t('capture.extracting_facts', prefs.uiLang));
      const updatedCaseState = await MunshiApiClient.understand({
        docTypeId: activeDocTypeId,
        customBrief: caseState?.customBrief,
        params: caseState?.params || {},
        segments: allSegments,
        docs: caseState?.docs || [],
        inputLang: newSegment.lang,
        previousCase: caseState || undefined,
      });

      setCaseState(updatedCaseState);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Handler when document is read by Vision
  const handleDocumentProcessed = async (
    newDoc: CaseDoc,
    extractedFields?: Fact[],
    extractedContacts?: Contact[]
  ) => {
    const existingDocs = caseState?.docs || [];
    const allDocs = [...existingDocs, newDoc];

    try {
      setLoading(true, t('capture.reading_doc', prefs.uiLang));

      const updatedCaseState = await MunshiApiClient.understand({
        docTypeId: activeDocTypeId,
        customBrief: caseState?.customBrief,
        params: caseState?.params || {},
        segments: caseState?.segments || [],
        docs: allDocs,
        inputLang: caseState?.inputLang || 'en-IN',
        previousCase: caseState || undefined,
      });

      // Merge any contacts found directly from OCR
      if (extractedContacts && extractedContacts.length > 0) {
        const existingContacts = updatedCaseState.contacts || [];
        const contactMap = new Map(existingContacts.map((c) => [c.email, c]));
        extractedContacts.forEach((c) => contactMap.set(c.email, c));
        updatedCaseState.contacts = Array.from(contactMap.values());
      }

      setCaseState(updatedCaseState);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger draft generation (POST /api/draft)
  const handleGenerateDraft = async () => {
    if (!caseState) return;

    try {
      setIsDrafting(true);
      setLoading(true, t('document.drafting', prefs.uiLang, { type: activeDocTypeId }));
      setError(null);

      const letterLang =
        prefs.letterLang === 'same'
          ? caseState.inputLang || 'en-IN'
          : prefs.letterLang;

      // Switch to document tab on phone
      setActivePhoneTab('document');

      const initialDraft: Draft = {
        caseId: caseState.caseId,
        version: 1,
        lang: letterLang,
        docType: activeDocTypeId,
        layout: docTypeDef?.layout || 'letter',
        tone: prefs.tone || { id: 'formal' },
        blocks: [],
      };
      setDraft(initialDraft, false);

      const finalDraft = await MunshiApiClient.streamDraft(
        {
          case: caseState,
          letterLang,
          tone: prefs.tone || { id: 'formal' },
          params: caseState.params || {},
          today: new Date().toISOString().split('T')[0],
        },
        (event) => {
          if (event.type === 'block') {
            setDraft({
              ...initialDraft,
              blocks: [...initialDraft.blocks.filter((b) => b.id !== event.block.id), event.block],
            });
          }
        }
      );

      setDraft(finalDraft, true);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsDrafting(false);
      setLoading(false);
    }
  };

  const hasInputs =
    (caseState?.segments && caseState.segments.length > 0) ||
    (caseState?.docs && caseState.docs.length > 0);

  return (
    <div id="capture-panel" className="flex flex-col gap-4 p-4 lg:p-6 overflow-y-auto">
      {/* Dynamic Type Options Form (PRD FE-23) */}
      <TypeOptionsForm />

      {/* Voice Recorder with level meter and language chip (PRD FE-5) */}
      <VoiceRecorderWidget onTranscriptionComplete={handleTranscriptionComplete} />

      {/* Typed Fallback (PRD FE-5: typed fallback for every voice interaction) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <form onSubmit={handleTypedNotesSubmit} className="space-y-2">
          <label htmlFor="typed-notes" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <PenLine className="h-3.5 w-3.5 text-munshi-600" />
            <span>Type notes or prompt (typed fallback)</span>
          </label>
          <div className="relative">
            <textarea
              id="typed-notes"
              rows={2}
              value={typedNotes}
              onChange={(e) => setTypedNotes(e.target.value)}
              placeholder={t('capture.type_hint', prefs.uiLang)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-munshi-500 focus:outline-none focus:ring-1 focus:ring-munshi-500"
            />
            {typedNotes.trim() && (
              <button
                type="submit"
                className="absolute right-2 bottom-3 flex items-center gap-1 rounded-lg bg-munshi-600 px-2.5 py-1 text-[11px] font-medium text-white shadow hover:bg-munshi-700 transition-colors"
              >
                <Send className="h-3 w-3" />
                <span>Add</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Document Upload Zone (PRD FE-7: expected/optional/hidden) */}
      <DocumentUpload
        uploadMode={uploadMode}
        onDocumentProcessed={handleDocumentProcessed}
      />

      {/* Raw Transcript (PRD FE-6) */}
      {caseState?.segments && caseState.segments.length > 0 && (
        <RawTranscript segments={caseState.segments} />
      )}

      {/* Field Chips and Contact Cards (PRD FE-8) */}
      <FieldChips />

      {/* Understanding Review: Facts, confidence, conflicts (PRD FE-9) */}
      {caseState && (caseState.facts.length > 0 || caseState.missing.length > 0) && (
        <UnderstandingReview />
      )}

      {/* Follow-up card: missing facts with Bulbul TTS and answers (PRD FE-10) */}
      <FollowUpCard />

      {/* Primary Action Button: Generate / Update Draft */}
      {hasInputs && (
        <div className="pt-2">
          <button
            type="button"
            onClick={handleGenerateDraft}
            disabled={isDrafting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-munshi-600 py-3.5 px-4 text-sm font-semibold text-white shadow-soft-md hover:bg-munshi-700 active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {isDrafting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span>{draft ? 'Update / Regenerate Draft' : 'Draft Document with Munshi'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
