'use client';

import React, { useState } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { getDocTypeById } from '@/config/doctypes';
import { t } from '@/lib/i18n';
import {
  Tag,
  CheckCircle2,
  Mail,
  AlertTriangle,
  Edit2,
  Check,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import type { Contact, Fact } from '@/contracts';

export const FieldChips: React.FC = () => {
  const { caseState, contacts, updateContact, prefs } = useMunshiStore();
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');

  const activeDocTypeId = caseState?.docType || prefs.lastDocType || 'grievance';
  const docTypeDef = getDocTypeById(activeDocTypeId);

  const extractableFields = docTypeDef?.extractableFields || [];
  const currentFacts = caseState?.facts || [];

  const handleStartEdit = (contact: Contact) => {
    setEditingContactId(contact.id);
    setEditEmail(contact.email);
  };

  const handleSaveContact = (contactId: string) => {
    if (editEmail.trim()) {
      updateContact(contactId, {
        email: editEmail.trim(),
        needsConfirmation: false,
      });
    }
    setEditingContactId(null);
  };

  const handleConfirmContact = (contactId: string) => {
    updateContact(contactId, { needsConfirmation: false });
  };

  return (
    <div className="space-y-3">
      {/* Extractable Field Chips */}
      {extractableFields.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-soft">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Tag className="h-3 w-3 text-slate-400" />
            Key Fields Extracted
          </div>
          <div className="flex flex-wrap gap-2">
            {extractableFields.map((field) => {
              const matchedFact = currentFacts.find((f) => f.key === field.key);
              const isFound = Boolean(matchedFact && matchedFact.value);

              return (
                <div
                  key={field.key}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-all ${
                    isFound
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium'
                      : 'bg-slate-50 text-slate-400 border border-slate-200 border-dashed'
                  }`}
                  title={field.hint}
                >
                  {isFound ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                  )}
                  <span>{t(field.labelKey, prefs.uiLang)}</span>
                  {isFound && (
                    <span className="font-semibold text-slate-900 ml-1">
                      : {matchedFact?.value}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Extracted Contacts / Addresses for Confirmation */}
      {contacts.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-munshi-600" />
              {t('capture.contacts_title', prefs.uiLang)}
            </h4>
            <span className="text-[10px] text-slate-400">
              From document / OCR
            </span>
          </div>

          <div className="space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`rounded-xl border p-2.5 text-xs transition-all ${
                  contact.needsConfirmation
                    ? 'border-amber-300 bg-amber-50/60'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">
                      {contact.label || 'Recipient'}
                    </span>
                    {contact.needsConfirmation && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-medium text-amber-800 border border-amber-200">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Verify address
                      </span>
                    )}
                  </div>

                  {contact.trust === 'official' ? (
                    <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                      <ShieldCheck className="h-3 w-3" /> Official
                    </span>
                  ) : contact.trust === 'third_party' ? (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-medium">
                      <ShieldAlert className="h-3 w-3" /> Third-party
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 flex items-center justify-between gap-2">
                  {editingContactId === contact.id ? (
                    <div className="flex flex-1 items-center gap-1.5">
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-0.5 text-xs focus:border-munshi-500 focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveContact(contact.id)}
                        className="rounded bg-munshi-600 p-1 text-white hover:bg-munshi-700"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-mono text-slate-900 font-semibold truncate select-all">
                      {contact.email}
                    </span>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    {editingContactId !== contact.id && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(contact)}
                        className="rounded p-1 text-slate-400 hover:text-slate-700"
                        title="Edit address"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    )}

                    {contact.needsConfirmation && editingContactId !== contact.id && (
                      <button
                        type="button"
                        onClick={() => handleConfirmContact(contact.id)}
                        className="rounded bg-amber-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-amber-700 transition-colors"
                      >
                        {t('capture.confirm_contact', prefs.uiLang)}
                      </button>
                    )}
                  </div>
                </div>

                {contact.snippet && (
                  <p className="mt-1 text-[10px] text-slate-500 italic line-clamp-1">
                    "{contact.snippet}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
