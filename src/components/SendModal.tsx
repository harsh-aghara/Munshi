'use client';

import React, { useState, useEffect } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { getDocTypeById } from '@/config/doctypes';
import { buildMailtoUrl, buildGmailUrl } from '@/lib/mailto';
import { exportToPdf } from '@/lib/pdf';
import { t } from '@/lib/i18n';
import {
  X,
  Mail,
  Send,
  ExternalLink,
  Copy,
  Check,
  Printer,
  ShieldCheck,
  ShieldAlert,
  FileText,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import type { Contact } from '@/contracts';

export const SendModal: React.FC = () => {
  const {
    showSendModal,
    setShowSendModal,
    draft,
    contacts,
    prefs,
    caseState,
  } = useMunshiStore();

  const [toEmail, setToEmail] = useState('');
  const [subjectText, setSubjectText] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [copied, setCopied] = useState(false);
  const [clipboardFallbackNotice, setClipboardFallbackNotice] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const activeDocTypeId = draft?.docType || caseState?.docType || prefs.lastDocType || '';
  const docTypeDef = getDocTypeById(activeDocTypeId);
  const isSendable = docTypeDef?.sendable ?? false;

  useEffect(() => {
    if (showSendModal && draft) {
      // Find subject block if present
      const subjectBlock = draft.blocks.find((b) => b.role === 'subject');
      const subject = subjectBlock ? subjectBlock.text : `${docTypeDef?.id || 'Letter'} Draft`;

      // Full document body
      const body = draft.blocks
        .filter((b) => b.role !== 'subject' && b.role !== 'disclaimer')
        .map((b) => b.text)
        .join('\n\n');

      setSubjectText(subject);
      setBodyText(body);

      // Default recipient
      if (contacts && contacts.length > 0) {
        setSelectedContact(contacts[0]);
        setToEmail(contacts[0].email);
      } else {
        setSelectedContact(null);
        setToEmail('');
      }
      setClipboardFallbackNotice(false);
    }
  }, [showSendModal, draft, contacts, docTypeDef]);

  if (!showSendModal || !draft) return null;

  const handleOpenMailApp = async () => {
    const res = await buildMailtoUrl({
      to: toEmail.trim(),
      subject: subjectText,
      body: bodyText,
    });

    if (res.type === 'clipboard_fallback') {
      setClipboardFallbackNotice(true);
    }

    window.location.href = res.url;
  };

  const handleOpenGmail = async () => {
    const res = await buildGmailUrl({
      to: toEmail.trim(),
      subject: subjectText,
      body: bodyText,
    });

    if (res.type === 'clipboard_fallback') {
      setClipboardFallbackNotice(true);
    }

    window.open(res.url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyBody = async () => {
    try {
      await navigator.clipboard.writeText(bodyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  const handleDownloadPdf = () => {
    exportToPdf(draft.layout, draft.lang);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 modal-backdrop">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-munshi-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-munshi-100 text-munshi-700">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t('send.modal_title', prefs.uiLang)}
              </h3>
              <p className="text-xs text-slate-400">
                Munshi prepares the email and hands off to your mail app
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSendModal(false)}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form fields */}
        <div className="mt-4 space-y-4">
          {/* Recipient Input & Source Badge (PRD FE-19) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="send-to-email" className="text-xs font-semibold text-slate-700">
                {t('send.recipient_label', prefs.uiLang)}
              </label>

              {/* Source Badge */}
              {selectedContact && (
                <div className="flex items-center gap-1">
                  {selectedContact.origin === 'document' ? (
                    <span className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                      <FileText className="h-2.5 w-2.5 text-slate-500" />
                      {t('send.source_doc', prefs.uiLang)}
                    </span>
                  ) : selectedContact.trust === 'official' ? (
                    <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 border border-emerald-200">
                      <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" />
                      {t('send.source_official', prefs.uiLang)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
                      <ShieldAlert className="h-2.5 w-2.5 text-amber-600" />
                      {t('send.source_third_party', prefs.uiLang)}
                    </span>
                  )}
                </div>
              )}
            </div>

            <input
              id="send-to-email"
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder={t('send.recipient_placeholder', prefs.uiLang)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 font-mono shadow-sm focus:border-munshi-500 focus:outline-none focus:ring-1 focus:ring-munshi-500"
            />
          </div>

          {/* Subject Field */}
          <div>
            <label htmlFor="send-subject" className="text-xs font-semibold text-slate-700 block mb-1">
              {t('send.subject_label', prefs.uiLang)}
            </label>
            <input
              id="send-subject"
              type="text"
              value={subjectText}
              onChange={(e) => setSubjectText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 font-medium shadow-sm focus:border-munshi-500 focus:outline-none focus:ring-1 focus:ring-munshi-500"
            />
          </div>

          {/* Body Preview */}
          <div>
            <label htmlFor="send-body" className="text-xs font-semibold text-slate-700 block mb-1">
              {t('send.body_label', prefs.uiLang)}
            </label>
            <textarea
              id="send-body"
              rows={5}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 shadow-sm focus:border-munshi-500 focus:outline-none focus:ring-1 focus:ring-munshi-500 font-normal leading-relaxed"
            />
          </div>

          {/* Long link fallback warning */}
          {clipboardFallbackNotice && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>{t('send.clipboard_copied', prefs.uiLang)}</span>
            </div>
          )}

          {/* Hint to attach PDF */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>{t('send.download_pdf_hint', prefs.uiLang)}</span>
          </div>

          {/* Action buttons (PRD FE-19) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyBody}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy body'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>PDF</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenGmail}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/60 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{t('send.open_gmail', prefs.uiLang)}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenMailApp}
                className="flex items-center gap-1.5 rounded-xl bg-munshi-600 px-4 py-2 text-xs font-semibold text-white shadow-soft hover:bg-munshi-700 active:scale-95 transition-all"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{t('send.open_mail_app', prefs.uiLang)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
