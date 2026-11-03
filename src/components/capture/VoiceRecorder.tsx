'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { VoiceRecorder, formatTime } from '@/lib/audio';
import { MunshiApiClient } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { Mic, Square, Loader2, Volume2, AlertCircle } from 'lucide-react';
import { LANGUAGES } from '@/config/languages';
import type { Segment } from '@/contracts';

interface VoiceRecorderProps {
  onTranscriptionComplete: (segments: Segment[]) => void;
}

export const VoiceRecorderWidget: React.FC<VoiceRecorderProps> = ({
  onTranscriptionComplete,
}) => {
  const { prefs, setPrefs, setLoading, setError } = useMunshiStore();
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.cancel();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setRecordingError(null);
      const recorder = new VoiceRecorder();
      recorderRef.current = recorder;

      setRecordSeconds(0);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);

      await recorder.start({
        onLevelChange: (level) => {
          setAudioLevel(level);
        },
      });
    } catch (err: any) {
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingError(err.message || 'Could not start microphone');
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current || !isRecording) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setAudioLevel(0);

    try {
      const blob = await recorderRef.current.stop();

      // If recording was an accidental micro-click (< 500 bytes), ignore cleanly
      if (blob.size < 500) {
        return;
      }

      setLoading(true, t('capture.processing_audio', prefs.uiLang));
      const lang = prefs.dictationLang || 'auto';
      const result = await MunshiApiClient.speechToText(blob, lang);

      if (result.segments && result.segments.length > 0) {
        onTranscriptionComplete(result.segments);
      }
    } catch (err: any) {
      setError(err);
      setRecordingError(err.message || 'Speech recognition failed');
    } finally {
      setLoading(false);
    }
  };

  const currentDictationLangLabel =
    prefs.dictationLang === 'auto'
      ? t('setup.auto_detect', prefs.uiLang)
      : LANGUAGES.find((l) => l.code === prefs.dictationLang)?.label || prefs.dictationLang;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      {/* Top row: Status, Dictation Language Chip, Duration */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {isRecording ? (
            <span className="flex items-center gap-1.5 font-medium text-red-600 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-red-600" />
              {t('capture.listening', prefs.uiLang)}
            </span>
          ) : (
            <span className="font-medium text-slate-600">
              {t('capture.speak_hint', prefs.uiLang)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Dictation language chip (PRD FE-5: changeable before every recording) */}
          <div className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
            <Volume2 className="h-3 w-3 text-slate-500" />
            <span>{currentDictationLangLabel}</span>
          </div>

          {isRecording && (
            <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full animate-pulse shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-ping" />
              {formatTime(recordSeconds)}
            </span>
          )}
        </div>
      </div>

      {/* Main recording control and Level Meter */}
      <div className="flex items-center gap-4">
        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-munshi-600 text-white shadow-soft-md hover:bg-munshi-700 active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-munshi-500/20"
            title="Start voice recording"
          >
            <Mic className="h-7 w-7" />
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-soft-md hover:bg-red-700 active:scale-95 transition-all animate-pulse focus:outline-none focus:ring-4 focus:ring-red-500/20"
            title="Stop voice recording"
          >
            <Square className="h-6 w-6" />
          </button>
        )}

        {/* Audio Level Wave / Meter */}
        <div className="flex-1 flex flex-col justify-center gap-1.5">
          <div className="flex items-center gap-1 h-8 w-full bg-slate-50 rounded-xl p-1.5 border border-slate-100 overflow-hidden">
            {isRecording ? (
              Array.from({ length: 24 }).map((_, i) => {
                const heightPercent = Math.max(
                  15,
                  Math.min(100, Math.sin(i * 0.5 + audioLevel * 10) * 50 + audioLevel * 80)
                );
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-full bg-munshi-500 transition-all duration-75"
                    style={{ height: `${heightPercent}%` }}
                  />
                );
              })
            ) : (
              <div className="w-full text-center text-xs text-slate-400">
                Click microphone to record your thoughts in your own words
              </div>
            )}
          </div>
        </div>
      </div>

      {recordingError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-2 text-xs text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{recordingError}</span>
        </div>
      )}
    </div>
  );
};
