'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { DOCTYPES, CATEGORIES, getDocTypeById } from '@/config/doctypes';
import { TONES, getTonesForCategory, isToneAllowedForType } from '@/config/tones';
import { LANGUAGES, getDictationLanguages, getDocumentLanguages } from '@/config/languages';
import { t } from '@/lib/i18n';
import {
  Sparkles,
  ChevronDown,
  Search,
  PlusCircle,
  FileText,
  Volume2,
  Languages,
  PenTool,
  RotateCcw,
  Sliders,
} from 'lucide-react';

export const SetupBar: React.FC = () => {
  const {
    prefs,
    setPrefs,
    caseState,
    draft,
    setShowNewCaseModal,
    setShowLangChangeDialog,
    setShowCustomTypeModal,
  } = useMunshiStore();

  const [openDropdown, setOpenDropdown] = useState<
    'doctype' | 'tone' | 'dictationLang' | 'letterLang' | null
  >(null);

  const [doctypeSearch, setDoctypeSearch] = useState('');
  const [customToneInput, setCustomToneInput] = useState('');
  const [showCustomToneField, setShowCustomToneField] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeDocTypeId = caseState?.docType || prefs.lastDocType || 'grievance';
  const activeDocTypeDef = getDocTypeById(activeDocTypeId);

  const isAutoDetected = caseState?.docTypeSource === 'auto';
  const isCustomType = activeDocTypeId === 'custom';

  // Available tones for current doctype
  const allowedTones = activeDocTypeDef?.allowedTones || 'all';
  const categoryId = activeDocTypeDef?.category || 'complaints';
  const availableTones = getTonesForCategory(categoryId).filter((t) =>
    isToneAllowedForType(t.id, allowedTones, categoryId)
  );

  // Handler for doc type selection
  const handleSelectDocType = (typeId: string) => {
    if (typeId === 'custom') {
      setShowCustomTypeModal(true);
      setPrefs({ lastDocType: 'custom' });
    } else {
      setPrefs({ lastDocType: typeId });
      // Update default tone if current tone not allowed
      const newDef = getDocTypeById(typeId);
      if (newDef) {
        setPrefs({ tone: { id: newDef.defaultTone } });
      }
    }
    setOpenDropdown(null);
  };

  // Handler for tone selection
  const handleSelectTone = (toneId: string) => {
    setPrefs({ tone: { id: toneId } });
    setShowCustomToneField(false);
    setOpenDropdown(null);
  };

  const handleCustomToneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customToneInput.trim();
    if (trimmed) {
      setPrefs({ tone: { custom: trimmed.slice(0, 120) } });
      setOpenDropdown(null);
    }
  };

  // Handler for document language change
  const handleSelectDocLang = (langCode: string) => {
    if (draft) {
      // PRD FE-25: Changing "Write it in" after a draft exists opens a two-button dialog
      setShowLangChangeDialog({ targetLang: langCode });
    } else {
      setPrefs({ letterLang: langCode });
    }
    setOpenDropdown(null);
  };

  return (
    <div
      id="setup-bar"
      ref={containerRef}
      className="sticky top-0 z-30 w-full border-b border-munshi-200 bg-white/95 backdrop-blur shadow-sm px-4 py-2.5"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        {/* Left: Munshi Brand & Tagline */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-munshi-600 text-white font-bold shadow-soft">
              मु
            </span>
            <div>
              <span className="font-semibold text-slate-900 text-base tracking-tight">
                {t('app.title', prefs.uiLang)}
              </span>
              <span className="hidden md:inline-block ml-2 text-xs text-slate-500 font-normal">
                {t('app.tagline', prefs.uiLang)}
              </span>
            </div>
          </div>
        </div>

        {/* Center: The 4 Independent Choice Pickers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Writing Type Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'doctype' ? null : 'doctype')}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-sm transition-all ${
                openDropdown === 'doctype'
                  ? 'border-munshi-600 bg-munshi-50 text-munshi-900 ring-2 ring-munshi-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-munshi-600" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  {t('setup.writing_type', prefs.uiLang)}
                </span>
                <span className="truncate max-w-[140px] text-slate-900 font-semibold">
                  {isCustomType
                    ? t('doctype.custom.label', prefs.uiLang)
                    : activeDocTypeDef
                    ? t(activeDocTypeDef.labelKey, prefs.uiLang)
                    : t('setup.let_munshi_decide', prefs.uiLang)}
                </span>
              </div>
              {isAutoDetected && (
                <span className="ml-1 inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                  <Sparkles className="mr-0.5 h-2.5 w-2.5" />
                  {t('setup.munshi_chose_this', prefs.uiLang)}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {/* Writing Type Dropdown */}
            {openDropdown === 'doctype' && (
              <div className="absolute left-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50">
                {/* Search Box */}
                <div className="relative mb-2 px-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={doctypeSearch}
                    onChange={(e) => setDoctypeSearch(e.target.value)}
                    placeholder={t('setup.search_types', prefs.uiLang)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-munshi-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-munshi-500"
                  />
                </div>

                {/* Option 1: Let Munshi Decide */}
                <div className="mb-2 border-b border-slate-100 pb-1">
                  <button
                    type="button"
                    onClick={() => handleSelectDocType('auto')}
                    className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-munshi-50 transition-colors"
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 text-munshi-600 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        {t('setup.let_munshi_decide', prefs.uiLang)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Auto-detect type from what you speak or upload
                      </div>
                    </div>
                  </button>
                </div>

                {/* Categorized List */}
                <div className="space-y-3">
                  {CATEGORIES.filter((c) => c.id !== 'custom').map((category) => {
                    const typesInCategory = DOCTYPES.filter((d) => d.category === category.id).filter(
                      (d) =>
                        !doctypeSearch ||
                        t(d.labelKey, prefs.uiLang)
                          .toLowerCase()
                          .includes(doctypeSearch.toLowerCase()) ||
                        t(d.descriptionKey, prefs.uiLang)
                          .toLowerCase()
                          .includes(doctypeSearch.toLowerCase())
                    );

                    if (typesInCategory.length === 0) return null;

                    return (
                      <div key={category.id}>
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {t(category.labelKey, prefs.uiLang)}
                        </div>
                        <div className="space-y-0.5">
                          {typesInCategory.map((dt) => (
                            <button
                              key={dt.id}
                              type="button"
                              onClick={() => handleSelectDocType(dt.id)}
                              className={`flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                                activeDocTypeId === dt.id
                                  ? 'bg-munshi-50 text-munshi-900 font-medium'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span className="text-xs font-medium text-slate-800">
                                {t(dt.labelKey, prefs.uiLang)}
                              </span>
                              <span className="text-[10px] text-slate-400 line-clamp-1">
                                {t(dt.descriptionKey, prefs.uiLang)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Last Option: Something Else (Describe It) */}
                <div className="mt-2 border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSelectDocType('custom')}
                    className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-munshi-50 transition-colors"
                  >
                    <PlusCircle className="mt-0.5 h-4 w-4 text-munshi-600 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        {t('setup.something_else', prefs.uiLang)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Describe any other document; Munshi proposes structure
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Tone Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'tone' ? null : 'tone')}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-sm transition-all ${
                openDropdown === 'tone'
                  ? 'border-munshi-600 bg-munshi-50 text-munshi-900 ring-2 ring-munshi-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <PenTool className="h-3.5 w-3.5 text-munshi-600" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  {t('setup.tone', prefs.uiLang)}
                </span>
                <span className="truncate max-w-[110px] text-slate-900 font-semibold">
                  {prefs.tone && 'custom' in prefs.tone
                    ? prefs.tone.custom
                    : prefs.tone && 'id' in prefs.tone
                    ? t(`tone.${prefs.tone.id}`, prefs.uiLang)
                    : t('tone.formal', prefs.uiLang)}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {/* Tone Dropdown */}
            {openDropdown === 'tone' && (
              <div className="absolute left-0 mt-2 w-64 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('setup.tone', prefs.uiLang)}
                </div>
                <div className="space-y-0.5">
                  {availableTones.map((tone) => (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() => handleSelectTone(tone.id)}
                      className={`flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                        prefs.tone && 'id' in prefs.tone && prefs.tone.id === tone.id
                          ? 'bg-munshi-50 font-medium text-munshi-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="font-medium">{t(tone.labelKey, prefs.uiLang)}</span>
                      <span className="text-[10px] text-slate-400 line-clamp-1">
                        {tone.guidance}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom Tone Input */}
                <div className="mt-2 border-t border-slate-100 pt-2 px-1">
                  {!showCustomToneField ? (
                    <button
                      type="button"
                      onClick={() => setShowCustomToneField(true)}
                      className="text-xs text-munshi-600 hover:text-munshi-700 font-medium flex items-center gap-1.5 py-1 px-1"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      {t('setup.describe_tone', prefs.uiLang)}
                    </button>
                  ) : (
                    <form onSubmit={handleCustomToneSubmit} className="space-y-2">
                      <input
                        type="text"
                        maxLength={120}
                        value={customToneInput}
                        onChange={(e) => setCustomToneInput(e.target.value)}
                        placeholder={t('setup.custom_tone_placeholder', prefs.uiLang)}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-munshi-500 focus:outline-none focus:ring-1 focus:ring-munshi-500"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowCustomToneField(false)}
                          className="rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                        >
                          {t('app.cancel', prefs.uiLang)}
                        </button>
                        <button
                          type="submit"
                          className="rounded-md bg-munshi-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-munshi-700"
                        >
                          {t('app.save', prefs.uiLang)}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Dictation Language Picker ("I will speak in") */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'dictationLang' ? null : 'dictationLang')}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-sm transition-all ${
                openDropdown === 'dictationLang'
                  ? 'border-munshi-600 bg-munshi-50 text-munshi-900 ring-2 ring-munshi-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Volume2 className="h-3.5 w-3.5 text-munshi-600" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  {t('setup.dictation_lang', prefs.uiLang)}
                </span>
                <span className="truncate max-w-[100px] text-slate-900 font-semibold">
                  {prefs.dictationLang === 'auto'
                    ? t('setup.auto_detect', prefs.uiLang)
                    : LANGUAGES.find((l) => l.code === prefs.dictationLang)?.label || prefs.dictationLang}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {/* Dictation Languages Dropdown */}
            {openDropdown === 'dictationLang' && (
              <div className="absolute left-0 mt-2 w-56 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50">
                <button
                  type="button"
                  onClick={() => {
                    setPrefs({ dictationLang: 'auto' });
                    setOpenDropdown(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${
                    prefs.dictationLang === 'auto'
                      ? 'bg-munshi-50 font-medium text-munshi-900'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span>{t('setup.auto_detect', prefs.uiLang)}</span>
                  <span className="text-[10px] text-slate-400">Sarvam Saaras</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <div className="space-y-0.5">
                  {getDictationLanguages().map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setPrefs({ dictationLang: lang.code });
                        setOpenDropdown(null);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${
                        prefs.dictationLang === lang.code
                          ? 'bg-munshi-50 font-medium text-munshi-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{lang.label}</span>
                      <span className="text-[10px] text-slate-400">{lang.script}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Document Language Picker ("Write it in") */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'letterLang' ? null : 'letterLang')}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-sm transition-all ${
                openDropdown === 'letterLang'
                  ? 'border-munshi-600 bg-munshi-50 text-munshi-900 ring-2 ring-munshi-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Languages className="h-3.5 w-3.5 text-munshi-600" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  {t('setup.document_lang', prefs.uiLang)}
                </span>
                <span className="truncate max-w-[100px] text-slate-900 font-semibold">
                  {prefs.letterLang === 'same'
                    ? t('setup.same_as_speak', prefs.uiLang)
                    : LANGUAGES.find((l) => l.code === prefs.letterLang)?.label || prefs.letterLang}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {/* Document Languages Dropdown */}
            {openDropdown === 'letterLang' && (
              <div className="absolute right-0 md:left-0 mt-2 w-56 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50">
                <button
                  type="button"
                  onClick={() => handleSelectDocLang('same')}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${
                    prefs.letterLang === 'same'
                      ? 'bg-munshi-50 font-medium text-munshi-900'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span>{t('setup.same_as_speak', prefs.uiLang)}</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <div className="space-y-0.5">
                  {getDocumentLanguages().map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSelectDocLang(lang.code)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${
                        prefs.letterLang === lang.code
                          ? 'bg-munshi-50 font-medium text-munshi-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{lang.label}</span>
                      <span className="text-[10px] text-slate-400">{lang.script}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: UI Language toggle & New Case Button */}
        <div className="flex items-center gap-2">
          {/* UI Language selector */}
          <select
            value={prefs.uiLang}
            onChange={(e) => setPrefs({ uiLang: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:border-slate-300 focus:outline-none"
            title="UI Language"
          >
            <option value="en-IN">English</option>
            <option value="hi-IN">हिन्दी</option>
          </select>

          {/* New Case Button */}
          <button
            type="button"
            onClick={() => setShowNewCaseModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t('app.new_case', prefs.uiLang)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
