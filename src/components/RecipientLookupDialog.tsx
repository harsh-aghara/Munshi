'use client';

import React, { useState } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { MunshiApiClient } from '@/lib/api-client';
import { VoiceRecorder } from '@/lib/audio';
import { t } from '@/lib/i18n';
import {
  Search,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  HelpCircle,
  Mic,
  Square,
  Loader2,
  Building2,
} from 'lucide-react';
import type { Contact, LookupResult } from '@/contracts';

interface RecipientLookupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialOrg?: string;
}

export const RecipientLookupDialog: React.FC<RecipientLookupDialogProps> = ({
  isOpen,
  onClose,
  initialOrg = '',
}) => {
  const { prefs, updateContact, contacts, setError } = useMunshiStore();

  const [org, setOrg] = useState(initialOrg);
  const [dept, setDept] = useState('');
  const [location, setLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);

  // Clarification state
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [isRecordingAnswer, setIsRecordingAnswer] = useState(false);
  const recorderRef = React.useRef<VoiceRecorder | null>(null);

  // Manual fallback state
  const [manualEmail, setManualEmail] = useState('');

  if (!isOpen) return null;

  const handleSearch = async (answer?: string) => {
    if (!org.trim()) return;

    try {
      setIsSearching(true);
      const res = await MunshiApiClient.lookupRecipient({
        hint: {
          raw: `${org} ${dept} ${location}`.trim(),
          org: org.trim(),
          dept: dept.trim() || undefined,
          location: location.trim() || undefined,
        },
        clarificationAnswer: answer || clarificationAnswer.trim() || undefined,
      });

      setResult(res);
      if (res.status === 'ok' && res.candidates.length > 0) {
        // Merge into store contacts
        useMunshiStore.setState((s) => ({
          contacts: [...s.contacts, ...res.candidates],
        }));
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCandidate = (candidate: Contact) => {
    useMunshiStore.setState((s) => ({
      contacts: [candidate, ...s.contacts.filter((c) => c.id !== candidate.id)],
    }));
    onClose();
  };

  const handleManualAdd = () => {
    const trimmed = manualEmail.trim();
    if (!trimmed) return;

    const newContact: Contact = {
      id: `manual_${Date.now()}`,
      email: trimmed,
      label: org || 'Recipient',
      origin: 'web',
      trust: 'third_party',
      snippet: 'Manually entered address',
      needsConfirmation: true,
    };

    useMunshiStore.setState((s) => ({
      contacts: [newContact, ...s.contacts],
    }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 modal-backdrop">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-munshi-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-munshi-100 text-munshi-700">
              <Building2 className="h-5 w-5" />
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Find Official Recipient
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          {/* Query Inputs */}
          <div className="space-y-2">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Organisation / Company / Authority *
              </label>
              <input
                type="text"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="e.g. Torrent Power, SBI Bank, Municipal Corporation"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-munshi-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Department (optional)
                </label>
                <input
                  type="text"
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  placeholder="e.g. Billing, Grievance, HR"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-munshi-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Location / City (optional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Ahmedabad, Mumbai, South Delhi"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-munshi-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSearch()}
              disabled={isSearching || !org.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-munshi-600 py-2.5 text-xs font-semibold text-white shadow-soft hover:bg-munshi-700 active:scale-95 disabled:opacity-50 transition-all"
            >
              {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              <span>Search verified official email</span>
            </button>
          </div>

          {/* Clarification state (PRD FE-20) */}
          {result && result.status === 'needs_clarification' && result.clarification && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-amber-900">
                <HelpCircle className="h-4 w-4 text-amber-600" />
                <span>Clarification Needed</span>
              </div>
              <p className="text-slate-800">{result.clarification.question}</p>

              {result.clarification.options && result.clarification.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {result.clarification.options.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setClarificationAnswer(opt);
                        handleSearch(opt);
                      }}
                      className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs text-amber-900 hover:bg-amber-100"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={clarificationAnswer}
                  onChange={(e) => setClarificationAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-munshi-500"
                />
                <button
                  type="button"
                  onClick={() => handleSearch(clarificationAnswer)}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Results: Candidates (up to 3) */}
          {result && result.status === 'ok' && result.candidates.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[10px]">
                Found Candidates ({result.candidates.length})
              </h4>
              <div className="space-y-2">
                {result.candidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{cand.label}</span>
                        {cand.trust === 'official' ? (
                          <span className="flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-medium text-emerald-800">
                            <ShieldCheck className="h-2.5 w-2.5" /> Official
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-medium text-amber-800">
                            <ShieldAlert className="h-2.5 w-2.5" /> Third-party
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-slate-800 font-medium">{cand.email}</div>
                      {cand.snippet && (
                        <p className="text-[10px] text-slate-500 line-clamp-1 italic">
                          "{cand.snippet}"
                        </p>
                      )}
                      {cand.sourceUrl && (
                        <a
                          href={cand.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-munshi-600 hover:underline"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          <span>Source URL</span>
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectCandidate(cand)}
                      className="rounded-lg bg-munshi-600 px-3 py-1.5 text-xs font-semibold text-white shadow-soft hover:bg-munshi-700 shrink-0"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not Found state with fallback and portal link */}
          {result && result.status === 'not_found' && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <AlertCircle className="h-4 w-4 text-slate-400" />
                <span>No verified email address found</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                We could not find an official direct email for this authority. You can manually enter an address, or use their online complaint portal if available.
              </p>

              {result.portalUrl && (
                <a
                  href={result.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-munshi-600 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Visit Official Grievance Portal</span>
                </a>
              )}

              {/* Manual Entry */}
              <div className="pt-2 border-t border-slate-200">
                <label className="font-semibold text-slate-700 block mb-1">
                  Type or paste address manually:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="e.g. care@torrentpower.com"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-munshi-500"
                  />
                  <button
                    type="button"
                    onClick={handleManualAdd}
                    className="rounded-xl bg-munshi-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-munshi-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
