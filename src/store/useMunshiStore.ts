import { create } from 'zustand';
import type {
  CaseState,
  Draft,
  Contact,
  Prefs,
  ApiError,
  DocTypeId,
  ToneChoice,
  Lang,
  Fact,
} from '@/contracts';

const STORE_VERSION = 'v4.0.0';
const SESSION_STORAGE_KEY = `munshi_session_${STORE_VERSION}`;
const LOCAL_STORAGE_PREFS_KEY = `munshi_prefs_${STORE_VERSION}`;
const ACCESS_CODE_KEY = 'munshi_access_code';

export interface MunshiStoreState {
  // Session / Case
  caseState: CaseState | null;
  draft: Draft | null;
  draftHistory: Draft[];
  draftHistoryIndex: number;
  contacts: Contact[];
  focusedEvidenceId: string | null;

  // Preferences (Local Storage)
  prefs: Prefs;

  // Access Code (Session Storage)
  accessCode: string | null;
  isAccessDenied: boolean;
  isHydrated: boolean;

  // UI State
  isLoading: boolean;
  loadingMessage: string;
  error: ApiError | null;
  activePhoneTab: 'capture' | 'document';
  isPlayingTTS: boolean;
  currentTTSBlockId: string | null;

  // Modals & Panels
  showSendModal: boolean;
  showNewCaseModal: boolean;
  showLangChangeDialog: { targetLang: Lang } | null;
  showCustomTypeModal: boolean;

  // Actions
  setAccessCode: (code: string) => void;
  setAccessDenied: (denied: boolean) => void;
  setPrefs: (partial: Partial<Prefs>) => void;
  setCaseState: (state: CaseState | null | ((prev: CaseState | null) => CaseState | null)) => void;
  setDraft: (draft: Draft | null, addToHistory?: boolean) => void;
  undoDraft: () => void;
  redoDraft: () => void;
  setFocusedEvidenceId: (id: string | null) => void;
  updateFact: (factKey: string, newValue: string) => void;
  confirmFact: (factKey: string) => void;
  resolveConflict: (factKey: string, chosenValue: string) => void;
  updateContact: (contactId: string, partial: Partial<Contact>) => void;
  setLoading: (loading: boolean, message?: string) => void;
  setError: (error: ApiError | null) => void;
  setActivePhoneTab: (tab: 'capture' | 'document') => void;
  setIsPlayingTTS: (playing: boolean, blockId?: string | null) => void;
  setShowSendModal: (show: boolean) => void;
  setShowNewCaseModal: (show: boolean) => void;
  setShowLangChangeDialog: (dialog: { targetLang: Lang } | null) => void;
  setShowCustomTypeModal: (show: boolean) => void;
  updateDraftBlock: (blockId: string, newText: string) => void;
  commitDraftBlockEdit: (blockId: string, newText: string) => void;
  resetNewCase: () => void;
  rehydrate: () => void;
}

const defaultPrefs: Prefs = {
  uiLang: 'en-IN',
  dictationLang: 'auto',
  letterLang: 'same',
  tone: { id: 'formal' },
  lastDocType: 'grievance',
};

// Helper to load prefs from localStorage safely
function loadInitialPrefs(): Prefs {
  if (typeof window === 'undefined') return defaultPrefs;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PREFS_KEY);
    if (raw) {
      return { ...defaultPrefs, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load prefs from localStorage', e);
  }
  return defaultPrefs;
}

// Helper to load session state safely
function loadInitialSession(): {
  caseState: CaseState | null;
  draft: Draft | null;
  contacts: Contact[];
} {
  if (typeof window === 'undefined') {
    return { caseState: null, draft: null, contacts: [] };
  }
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        caseState: parsed.caseState || null,
        draft: parsed.draft || null,
        contacts: parsed.contacts || [],
      };
    }
  } catch (e) {
    console.error('Failed to load session from sessionStorage', e);
  }
  return { caseState: null, draft: null, contacts: [] };
}

function loadInitialAccessCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(ACCESS_CODE_KEY);
  } catch {
    return null;
  }
}

export const useMunshiStore = create<MunshiStoreState>((set, get) => {
  return {
    caseState: null,
    draft: null,
    draftHistory: [],
    draftHistoryIndex: -1,
    contacts: [],
    focusedEvidenceId: null,

    prefs: defaultPrefs,
    accessCode: null,
    isAccessDenied: false,
    isHydrated: false,

    isLoading: false,
    loadingMessage: '',
    error: null,
    activePhoneTab: 'capture',
    isPlayingTTS: false,
    currentTTSBlockId: null,

    showSendModal: false,
    showNewCaseModal: false,
    showLangChangeDialog: null,
    showCustomTypeModal: false,

    setAccessCode: (code: string) => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(ACCESS_CODE_KEY, code);
      }
      set({ accessCode: code, isAccessDenied: false });
    },

    setAccessDenied: (denied: boolean) => set({ isAccessDenied: denied }),

    setPrefs: (partial: Partial<Prefs>) => {
      set((state) => {
        const updated = { ...state.prefs, ...partial };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(LOCAL_STORAGE_PREFS_KEY, JSON.stringify(updated));
          } catch (e) {
            console.error(e);
          }
        }
        return { prefs: updated };
      });
    },

    setCaseState: (updater) => {
      set((state) => {
        const nextCaseState = typeof updater === 'function' ? updater(state.caseState) : updater;
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(
              SESSION_STORAGE_KEY,
              JSON.stringify({
                caseState: nextCaseState,
                draft: state.draft,
                contacts: state.contacts,
              })
            );
          } catch (e) {
            console.error(e);
          }
        }
        return { caseState: nextCaseState };
      });
    },

    setDraft: (newDraft: Draft | null, addToHistory = true) => {
      set((state) => {
        let history = state.draftHistory;
        let index = state.draftHistoryIndex;

        if (newDraft && addToHistory) {
          // Truncate any redo branches
          const trimmed = history.slice(0, index + 1);
          history = [...trimmed, newDraft];
          index = history.length - 1;
        }

        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(
              SESSION_STORAGE_KEY,
              JSON.stringify({
                caseState: state.caseState,
                draft: newDraft,
                contacts: state.contacts,
              })
            );
          } catch (e) {
            console.error(e);
          }
        }

        return {
          draft: newDraft,
          draftHistory: history,
          draftHistoryIndex: index,
        };
      });
    },

    undoDraft: () => {
      const state = get();
      if (state.draftHistoryIndex > 0) {
        const newIndex = state.draftHistoryIndex - 1;
        const prevDraft = state.draftHistory[newIndex];
        set({
          draft: prevDraft,
          draftHistoryIndex: newIndex,
        });
      }
    },

    redoDraft: () => {
      const state = get();
      if (state.draftHistoryIndex < state.draftHistory.length - 1) {
        const newIndex = state.draftHistoryIndex + 1;
        const nextDraft = state.draftHistory[newIndex];
        set({
          draft: nextDraft,
          draftHistoryIndex: newIndex,
        });
      }
    },

    updateDraftBlock: (blockId: string, newText: string) => {
      set((state) => {
        if (!state.draft) return state;

        const updatedBlocks = state.draft.blocks.map((b) =>
          b.id === blockId ? { ...b, text: newText } : b
        );

        const updatedDraft = {
          ...state.draft,
          blocks: updatedBlocks,
        };

        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(
              SESSION_STORAGE_KEY,
              JSON.stringify({
                caseState: state.caseState,
                draft: updatedDraft,
                contacts: state.contacts,
              })
            );
          } catch (e) {
            console.error(e);
          }
        }

        return {
          draft: updatedDraft,
        };
      });
    },

    commitDraftBlockEdit: (blockId: string, newText: string) => {
      const state = get();
      if (!state.draft) return;

      const lastHistoryDraft = state.draftHistory[state.draftHistoryIndex];
      const lastHistoryBlock = lastHistoryDraft?.blocks.find((b) => b.id === blockId);

      if (lastHistoryBlock && lastHistoryBlock.text === newText) {
        // No difference from last history version
        return;
      }

      const updatedBlocks = state.draft.blocks.map((b) =>
        b.id === blockId ? { ...b, text: newText } : b
      );

      const nextVersionDraft: Draft = {
        ...state.draft,
        version: (state.draft.version || 1) + 1,
        blocks: updatedBlocks,
      };

      state.setDraft(nextVersionDraft, true);
    },

    setFocusedEvidenceId: (id: string | null) => set({ focusedEvidenceId: id }),

    updateFact: (factKey: string, newValue: string) => {
      set((state) => {
        if (!state.caseState) return state;
        const updatedFacts = state.caseState.facts.map((f) => {
          if (f.key === factKey) {
            return {
              ...f,
              previousValue: f.value !== newValue ? f.value : f.previousValue,
              value: newValue,
              status: 'corrected' as const,
            };
          }
          return f;
        });

        const nextCaseState: CaseState = {
          ...state.caseState,
          facts: updatedFacts,
        };

        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({
              caseState: nextCaseState,
              draft: state.draft,
              contacts: state.contacts,
            })
          );
        }

        return { caseState: nextCaseState };
      });
    },

    confirmFact: (factKey: string) => {
      set((state) => {
        if (!state.caseState) return state;
        const updatedFacts = state.caseState.facts.map((f) =>
          f.key === factKey ? { ...f, status: 'confirmed' as const } : f
        );
        const nextCaseState: CaseState = { ...state.caseState, facts: updatedFacts };
        return { caseState: nextCaseState };
      });
    },

    resolveConflict: (factKey: string, chosenValue: string) => {
      set((state) => {
        if (!state.caseState) return state;
        const updatedFacts = state.caseState.facts.map((f) => {
          if (f.key === factKey) {
            return {
              ...f,
              value: chosenValue,
              status: 'confirmed' as const,
              alternatives: undefined,
            };
          }
          return f;
        });
        const nextCaseState: CaseState = { ...state.caseState, facts: updatedFacts };
        return { caseState: nextCaseState };
      });
    },

    updateContact: (contactId: string, partial: Partial<Contact>) => {
      set((state) => {
        const updated = state.contacts.map((c) => (c.id === contactId ? { ...c, ...partial } : c));
        return { contacts: updated };
      });
    },

    setLoading: (loading: boolean, message: string = '') =>
      set({ isLoading: loading, loadingMessage: message }),

    setError: (error: ApiError | null) => set({ error }),

    setActivePhoneTab: (tab: 'capture' | 'document') => set({ activePhoneTab: tab }),

    setIsPlayingTTS: (playing: boolean, blockId: string | null = null) =>
      set({ isPlayingTTS: playing, currentTTSBlockId: blockId }),

    setShowSendModal: (show: boolean) => set({ showSendModal: show }),
    setShowNewCaseModal: (show: boolean) => set({ showNewCaseModal: show }),
    setShowLangChangeDialog: (dialog) => set({ showLangChangeDialog: dialog }),
    setShowCustomTypeModal: (show: boolean) => set({ showCustomTypeModal: show }),

    resetNewCase: () => {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
      set({
        caseState: null,
        draft: null,
        draftHistory: [],
        draftHistoryIndex: -1,
        contacts: [],
        focusedEvidenceId: null,
        isLoading: false,
        loadingMessage: '',
        error: null,
        activePhoneTab: 'capture',
        isPlayingTTS: false,
        currentTTSBlockId: null,
        showSendModal: false,
        showNewCaseModal: false,
        showLangChangeDialog: null,
        showCustomTypeModal: false,
      });
    },

    rehydrate: () => {
      const prefs = loadInitialPrefs();
      const session = loadInitialSession();
      const accessCode = loadInitialAccessCode();
      set({
        prefs,
        caseState: session.caseState,
        draft: session.draft,
        draftHistory: session.draft ? [session.draft] : [],
        draftHistoryIndex: session.draft ? 0 : -1,
        contacts: session.contacts,
        accessCode,
        isHydrated: true,
      });
    },
  };
});
