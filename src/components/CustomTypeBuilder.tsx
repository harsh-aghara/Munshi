'use client';

import React, { useState } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { MunshiApiClient } from '@/lib/api-client';
import { VoiceRecorder } from '@/lib/audio';
import { t } from '@/lib/i18n';
import {
  Sparkles,
  Mic,
  Square,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Loader2,
  FileCode,
} from 'lucide-react';
import type { BlockRole, CustomDef } from '@/contracts';

const ALLOWED_ROLES: BlockRole[] = [
  'title',
  'heading',
  'salutation',
  'body',
  'stanza',
  'closing',
  'sender',
  'date',
  'recipient',
  'subject',
  'enclosures',
  'disclaimer',
];

export const CustomTypeBuilder: React.FC = () => {
  const {
    caseState,
    setCaseState,
    prefs,
    setPrefs,
    showCustomTypeModal,
    setShowCustomTypeModal,
    setLoading,
    setError,
  } = useMunshiStore();

  const [brief, setBrief] = useState(caseState?.customBrief || '');
  const [proposedDef, setProposedDef] = useState<CustomDef | null>(caseState?.customDef || null);
  const [isProposing, setIsProposing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [newRole, setNewRole] = useState<BlockRole>('body');

  const recorderRef = React.useRef<VoiceRecorder | null>(null);

  if (!showCustomTypeModal) return null;

  const handleStartVoice = async () => {
    try {
      const recorder = new VoiceRecorder();
      recorderRef.current = recorder;
      setIsRecording(true);
      await recorder.start();
    } catch (err: any) {
      setError(err);
      setIsRecording(false);
    }
  };

  const handleStopVoice = async () => {
    if (!recorderRef.current || !isRecording) return;
    try {
      setIsRecording(false);
      setLoading(true, t('capture.processing_audio', prefs.uiLang));
      const blob = await recorderRef.current.stop();
      const { segments } = await MunshiApiClient.speechToText(blob, prefs.dictationLang || 'auto');
      const text = segments.map((s) => s.text).join(' ').trim();
      if (text) {
        setBrief((prev) => (prev ? `${prev} ${text}` : text));
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProposeStructure = async () => {
    const trimmed = brief.trim();
    if (!trimmed) return;

    try {
      setIsProposing(true);
      setLoading(true, 'Munshi is designing your custom structure...');

      const result = await MunshiApiClient.understand({
        docTypeId: 'custom',
        customBrief: trimmed,
        segments: caseState?.segments || [],
        docs: caseState?.docs || [],
        inputLang: prefs.dictationLang === 'auto' ? 'en-IN' : prefs.dictationLang,
      });

      setCaseState(result);
      if (result.customDef) {
        setProposedDef(result.customDef);
      } else {
        // Fallback default structure
        setProposedDef({
          label: 'Custom Document',
          layout: 'prose',
          skeleton: ['title', 'body', 'closing'],
          requiredFacts: [],
          sendable: false,
          hasRecipient: false,
        });
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setIsProposing(false);
      setLoading(false);
    }
  };

  const handleMoveRole = (index: number, direction: 'up' | 'down') => {
    if (!proposedDef) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= proposedDef.skeleton.length) return;

    const newSkeleton = [...proposedDef.skeleton];
    const temp = newSkeleton[index];
    newSkeleton[index] = newSkeleton[targetIdx];
    newSkeleton[targetIdx] = temp;

    setProposedDef({ ...proposedDef, skeleton: newSkeleton });
  };

  const handleRemoveRole = (index: number) => {
    if (!proposedDef) return;
    const newSkeleton = proposedDef.skeleton.filter((_, i) => i !== index);
    setProposedDef({ ...proposedDef, skeleton: newSkeleton });
  };

  const handleAddRole = () => {
    if (!proposedDef) return;
    setProposedDef({ ...proposedDef, skeleton: [...proposedDef.skeleton, newRole] });
  };

  const handleConfirm = () => {
    if (!proposedDef) return;

    setCaseState((prev) => {
      if (!prev) {
        return {
          caseId: `case_${Date.now()}`,
          docType: 'custom',
          docTypeSource: 'user',
          customBrief: brief,
          customDef: proposedDef,
          params: {},
          inputLang: prefs.dictationLang === 'auto' ? 'en-IN' : prefs.dictationLang,
          segments: [],
          evidence: [],
          docs: [],
          facts: [],
          missing: proposedDef.requiredFacts.map((rf) => ({
            key: rf.key,
            label: rf.label,
            question: rf.question,
            required: true,
          })),
          contacts: [],
          round: 0,
        };
      }
      return {
        ...prev,
        docType: 'custom',
        customBrief: brief,
        customDef: proposedDef,
      };
    });

    setPrefs({ lastDocType: 'custom' });
    setShowCustomTypeModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 modal-backdrop">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-munshi-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-munshi-100 text-munshi-700">
              <FileCode className="h-5 w-5" />
            </span>
            <h3 className="text-base font-bold text-slate-900">
              {t('custom.builder_title', prefs.uiLang)}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowCustomTypeModal(false)}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1: Input description */}
        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold text-slate-700">
            What do you want to write?
          </label>
          <div className="relative">
            <textarea
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={t('custom.brief_placeholder', prefs.uiLang)}
              className="w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-munshi-500 focus:outline-none focus:ring-2 focus:ring-munshi-500/20"
            />
            <div className="absolute right-2 bottom-2">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={handleStartVoice}
                  className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-munshi-100 hover:text-munshi-700 transition-colors"
                  title="Speak your description"
                >
                  <Mic className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopVoice}
                  className="rounded-lg bg-red-600 p-1.5 text-white animate-pulse"
                  title="Stop recording"
                >
                  <Square className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleProposeStructure}
              disabled={isProposing || !brief.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-munshi-600 px-4 py-2 text-xs font-semibold text-white shadow-soft hover:bg-munshi-700 active:scale-95 disabled:opacity-50 transition-all"
            >
              {isProposing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>{t('custom.propose_button', prefs.uiLang)}</span>
            </button>
          </div>
        </div>

        {/* Step 2: Proposed Structure Review (PRD FE-26) */}
        {proposedDef && (
          <div className="mt-6 space-y-4 border-t border-slate-100 pt-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t('custom.proposed_structure', prefs.uiLang)}
                </h4>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Layout: <strong className="capitalize">{proposedDef.layout}</strong> • Name: {proposedDef.label}
                </div>
              </div>
            </div>

            {/* Block Skeleton Editor */}
            <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              {proposedDef.skeleton.map((role, idx) => (
                <div
                  key={`${role}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 font-mono text-[10px] text-slate-600">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800 capitalize">{role}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveRole(idx, 'up')}
                      className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === proposedDef.skeleton.length - 1}
                      onClick={() => handleMoveRole(idx, 'down')}
                      className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(idx)}
                      className="rounded p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add block role */}
              <div className="flex items-center gap-2 pt-2">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as BlockRole)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none"
                >
                  {ALLOWED_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddRole}
                  className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-3 w-3" />
                  Add section
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomTypeModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('app.cancel', prefs.uiLang)}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex items-center gap-1.5 rounded-xl bg-munshi-600 px-5 py-2 text-xs font-semibold text-white shadow-soft hover:bg-munshi-700 active:scale-95 transition-all"
              >
                <Check className="h-4 w-4" />
                <span>{t('custom.confirm_structure', prefs.uiLang)}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
