'use client';

import React, { useState } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { MunshiApiClient } from '@/lib/api-client';
import { VoiceRecorder, globalAudioPlayer, formatTime } from '@/lib/audio';
import { t } from '@/lib/i18n';
import {
  HelpCircle,
  Volume2,
  Mic,
  Square,
  Send,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import type { MissingFact } from '@/contracts';

export const FollowUpCard: React.FC = () => {
  const { caseState, setCaseState, prefs, setLoading, setError } = useMunshiStore();
  const [activeAnswers, setActiveAnswers] = useState<Record<string, string>>({});
  const [isPlayingAudio, setIsPlayingAudio] = useState<string | null>(null);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recorderRef = React.useRef<VoiceRecorder | null>(null);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      globalAudioPlayer.stop();
      if (recorderRef.current) {
        recorderRef.current.cancel();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  if (!caseState || !caseState.missing || caseState.missing.length === 0) {
    return null;
  }

  // Max 2 questions per round per PRD BE-9 / FE-10
  const activeQuestions = caseState.missing.slice(0, 2);

  // Play spoken question using Bulbul via POST /api/tts (PRD FE-10, BE-16)
  const handlePlayQuestion = async (mf: MissingFact) => {
    if (isPlayingAudio === mf.key) {
      globalAudioPlayer.stop();
      setIsPlayingAudio(null);
      return;
    }

    try {
      globalAudioPlayer.stop();
      setIsPlayingAudio(mf.key);
      const dictationLang = prefs.dictationLang === 'auto'
        ? (caseState?.inputLang || 'hi-IN')
        : prefs.dictationLang;
      const audioChunks = await MunshiApiClient.textToSpeech(mf.question, dictationLang);

      await globalAudioPlayer.playBase64Chunks(audioChunks);
    } catch (err) {
      console.warn('TTS playback failed', err);
    } finally {
      setIsPlayingAudio(null);
    }
  };

  // Voice answer recording
  const handleStartVoiceAnswer = async (key: string) => {
    try {
      const recorder = new VoiceRecorder();
      recorderRef.current = recorder;
      setRecordingKey(key);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
      await recorder.start();
    } catch (err: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      setError(err);
      setRecordingKey(null);
    }
  };

  const handleStopVoiceAnswer = async (key: string) => {
    if (!recorderRef.current || recordingKey !== key) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      setRecordingKey(null);
      setLoading(true, t('capture.processing_audio', prefs.uiLang));
      const blob = await recorderRef.current.stop();

      const lang = prefs.dictationLang || 'auto';
      const { segments } = await MunshiApiClient.speechToText(blob, lang);

      const transcribedText = segments.map((s) => s.text).join(' ').trim();
      if (transcribedText) {
        setActiveAnswers((prev) => ({ ...prev, [key]: transcribedText }));
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswers = async () => {
    const formattedAnswers = Object.entries(activeAnswers)
      .filter(([_, ans]) => ans.trim().length > 0)
      .map(([key, answer]) => ({ key, answer: answer.trim() }));

    if (formattedAnswers.length === 0) return;

    try {
      setIsSubmitting(true);
      setLoading(true, t('capture.extracting_facts', prefs.uiLang));

      const updatedCaseState = await MunshiApiClient.understand({
        docTypeId: caseState.docType,
        customBrief: caseState.customBrief,
        params: caseState.params,
        segments: caseState.segments,
        docs: caseState.docs,
        inputLang: caseState.inputLang,
        previousCase: caseState,
        answers: formattedAnswers,
      });

      setCaseState(updatedCaseState);
      setActiveAnswers({});
    } catch (err: any) {
      setError(err);
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-soft space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
          <HelpCircle className="h-4 w-4 text-amber-600" />
          Follow-up questions ({activeQuestions.length})
        </h4>
        <span className="text-[10px] text-amber-700 font-medium">
          Round {caseState.round + 1} of 2
        </span>
      </div>

      <div className="space-y-3">
        {activeQuestions.map((mf) => {
          const isRecordingThis = recordingKey === mf.key;
          const isPlayingThis = isPlayingAudio === mf.key;

          return (
            <div
              key={mf.key}
              className="rounded-xl border border-amber-200/80 bg-white p-3 space-y-2 text-xs shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-800">{mf.label}: </span>
                  <span className="text-slate-700">{mf.question}</span>
                </div>

                {/* Bulbul TTS button (click to play or click to stop) */}
                <button
                  type="button"
                  onClick={() => handlePlayQuestion(mf)}
                  className={`rounded-lg p-1.5 transition-colors shrink-0 ${
                    isPlayingThis
                      ? 'bg-amber-100 text-amber-800'
                      : 'text-munshi-700 hover:bg-munshi-50'
                  }`}
                  title={isPlayingThis ? 'Stop read aloud' : 'Listen to question (Bulbul TTS)'}
                >
                  {isPlayingThis ? (
                    <Square className="h-4 w-4 fill-current text-amber-800 animate-pulse" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-munshi-600" />
                  )}
                </button>
              </div>

              {/* Answer input (Typed or Voice) */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={activeAnswers[mf.key] || ''}
                  onChange={(e) =>
                    setActiveAnswers({ ...activeAnswers, [mf.key]: e.target.value })
                  }
                  placeholder="Type your answer here..."
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-900 focus:border-munshi-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-munshi-500"
                />

                {/* Voice input button for this question */}
                {!isRecordingThis ? (
                  <button
                    type="button"
                    onClick={() => handleStartVoiceAnswer(mf.key)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-munshi-100 hover:text-munshi-800 transition-colors"
                    title="Speak answer"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2 py-1 text-[11px] font-mono font-bold text-red-600 animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-ping" />
                      {formatTime(recordSeconds)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStopVoiceAnswer(mf.key)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white animate-pulse"
                      title="Stop recording"
                    >
                      <Square className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleSubmitAnswers}
          disabled={isSubmitting || Object.values(activeAnswers).every((v) => !v.trim())}
          className="flex items-center gap-1.5 rounded-xl bg-munshi-600 px-4 py-2 text-xs font-semibold text-white shadow-soft hover:bg-munshi-700 active:scale-95 disabled:opacity-50 transition-all"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          <span>Submit answers & update facts</span>
        </button>
      </div>
    </div>
  );
};
