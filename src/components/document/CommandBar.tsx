'use client';

import React, { useState } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { MunshiApiClient } from '@/lib/api-client';
import { VoiceRecorder, globalAudioPlayer } from '@/lib/audio';
import { exportToPdf } from '@/lib/pdf';
import { getDocTypeById } from '@/config/doctypes';
import { t } from '@/lib/i18n';
import {
  Mic,
  Square,
  Send,
  Loader2,
  Terminal,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import type { CommandResult, Draft } from '@/contracts';

export const CommandBar: React.FC = () => {
  const {
    draft,
    setDraft,
    caseState,
    setCaseState,
    prefs,
    setPrefs,
    undoDraft,
    redoDraft,
    setShowSendModal,
    setLoading,
    setError,
    setIsPlayingTTS,
  } = useMunshiStore();

  const [commandText, setCommandText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);

  const recorderRef = React.useRef<VoiceRecorder | null>(null);

  const handleStartVoice = async () => {
    try {
      setCommandFeedback(null);
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
        setCommandText(text);
        executeCommandText(text);
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const executeCommandText = async (text: string) => {
    if (!text.trim()) return;

    try {
      setLoading(true, 'Executing command...');
      setCommandFeedback(null);

      const result: CommandResult = await MunshiApiClient.executeCommand({
        text: text.trim(),
        draft: draft || undefined,
        case: caseState || undefined,
      });

      handleCommandResult(result);
      setCommandText('');
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCommandResult = async (result: CommandResult) => {
    switch (result.intent) {
      case 'EDIT': {
        if (!caseState || !draft) break;
        setCommandFeedback(`Applying edit: "${result.instruction}"`);
        const targetLang =
          prefs.letterLang === 'same'
            ? caseState.inputLang || 'en-IN'
            : prefs.letterLang;

        const updatedDraft = await MunshiApiClient.streamDraft(
          {
            case: caseState,
            letterLang: targetLang,
            tone: prefs.tone || { id: 'formal' },
            params: caseState.params,
            today: new Date().toISOString().split('T')[0],
            instruction: result.instruction,
            currentDraft: draft,
          },
          () => {}
        );
        setDraft(updatedDraft, true);
        break;
      }

      case 'TRANSLATE': {
        if (!draft) break;
        setCommandFeedback(`Translating to ${result.targetLang}...`);
        const translated = await MunshiApiClient.translateDraft(draft, result.targetLang);
        setDraft(translated, true);
        setPrefs({ letterLang: result.targetLang });
        break;
      }

      case 'SET_TONE': {
        if (!caseState || !draft) break;
        setPrefs({ tone: result.tone });
        const toneLabel = 'id' in result.tone ? result.tone.id : result.tone.custom;
        setCommandFeedback(`Updating tone to: ${toneLabel}`);

        const targetLang =
          prefs.letterLang === 'same'
            ? caseState.inputLang || 'en-IN'
            : prefs.letterLang;

        const updatedDraft = await MunshiApiClient.streamDraft(
          {
            case: caseState,
            letterLang: targetLang,
            tone: result.tone,
            params: caseState.params,
            today: new Date().toISOString().split('T')[0],
            toneChange: result.tone,
            currentDraft: draft,
          },
          () => {}
        );
        setDraft(updatedDraft, true);
        break;
      }

      case 'SET_DOCTYPE': {
        setPrefs({ lastDocType: result.docType });
        if (caseState) {
          setCaseState({ ...caseState, docType: result.docType });
        }
        setCommandFeedback(`Changed writing type to: ${result.docType}`);
        break;
      }

      case 'EXPORT': {
        if (draft) {
          exportToPdf(draft.layout, draft.lang);
          setCommandFeedback('Opening print dialog for PDF export...');
        }
        break;
      }

      case 'SEND': {
        const docTypeDef = getDocTypeById(draft?.docType || '');
        if (docTypeDef?.sendable) {
          setShowSendModal(true);
        } else {
          setCommandFeedback('This writing type does not have a mail hand-off.');
        }
        break;
      }

      case 'UNDO': {
        undoDraft();
        setCommandFeedback('Undo applied.');
        break;
      }

      case 'REDO': {
        redoDraft();
        setCommandFeedback('Redo applied.');
        break;
      }

      case 'READ_ALOUD': {
        setCommandFeedback('Reading aloud...');
        // Trigger read aloud playback
        if (draft && draft.blocks.length > 0) {
          playReadAloud();
        }
        break;
      }

      case 'SET_RECIPIENT': {
        setCommandFeedback(`Looking up recipient: ${result.hint.org}...`);
        try {
          const lookup = await MunshiApiClient.lookupRecipient({ hint: result.hint });
          if (lookup.candidates && lookup.candidates.length > 0) {
            // Update contacts in store
            useMunshiStore.setState((s) => ({
              contacts: [...s.contacts, ...lookup.candidates],
            }));
            setShowSendModal(true);
          } else if (lookup.status === 'needs_clarification' && lookup.clarification) {
            setCommandFeedback(lookup.clarification.question);
          } else {
            setCommandFeedback(
              `No email found. ${lookup.portalUrl ? `Official portal: ${lookup.portalUrl}` : ''}`
            );
          }
        } catch (e: any) {
          setError(e);
        }
        break;
      }

      case 'UNKNOWN':
      default: {
        setCommandFeedback(
          "I didn't quite catch that. Try commands like: 'make it firmer', 'translate to Hindi', 'read aloud', 'export PDF', or 'undo'."
        );
        break;
      }
    }
  };

  const playReadAloud = async () => {
    if (!draft) return;
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
      console.warn('TTS playback error for block', e);
    } finally {
      globalAudioPlayer.stop();
      setIsPlayingTTS(false, null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCommandText(commandText);
  };

  return (
    <div id="command-bar" className="border-t border-slate-200 bg-white p-3 shadow-soft-sm">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Terminal className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            placeholder={t('document.command_placeholder', prefs.uiLang)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-munshi-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-munshi-500"
          />

          <div className="absolute right-1.5 top-1">
            {!isRecording ? (
              <button
                type="button"
                onClick={handleStartVoice}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-munshi-100 hover:text-munshi-700 transition-colors"
                title="Voice command"
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

        <button
          type="submit"
          disabled={!commandText.trim()}
          className="rounded-xl bg-munshi-600 px-3.5 py-2 text-xs font-semibold text-white shadow-soft hover:bg-munshi-700 active:scale-95 disabled:opacity-40 transition-all shrink-0"
        >
          {t('document.command_button', prefs.uiLang)}
        </button>
      </form>

      {commandFeedback && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-munshi-50 px-2.5 py-1.5 text-[11px] text-munshi-900 border border-munshi-200">
          <HelpCircle className="h-3.5 w-3.5 shrink-0 text-munshi-600" />
          <span>{commandFeedback}</span>
        </div>
      )}
    </div>
  );
};
