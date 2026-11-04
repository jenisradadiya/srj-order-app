import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

// The order being put together. It is saved on the phone, so a cook can add
// items through the day and send the order later.

const DraftContext = createContext(null);

const newRef = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const emptyDraft = (branchId = null) => ({ ref: newRef(), branchId, items: [], note: '', voice: null });
const storageKey = (userId) => `srj.draft.${userId}`;

function readDraft(userId, fallbackBranch) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)));
    if (saved && Array.isArray(saved.items)) return saved;
  } catch {
    // Unreadable: start fresh.
  }
  return emptyDraft(fallbackBranch);
}

// Best effort: a recording that is no longer part of the draft.
const discardVoice = (voice) => voice && api(`/voice/${voice.id}`, { method: 'DELETE' }).catch(() => {});

export function DraftProvider({ children }) {
  const { user } = useAuth();
  const defaultBranch = user.branches[0]?.id ?? null;
  const [draft, setDraft] = useState(() => readDraft(user.id, defaultBranch));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(user.id), JSON.stringify(draft));
    } catch {
      // Storage full or blocked: the draft only lives until the page is closed.
    }
  }, [draft, user.id]);

  // A branch that no longer exists (or none chosen yet) falls back to the first one.
  const branchId = user.branches.some((b) => b.id === draft.branchId) ? draft.branchId : defaultBranch;

  const addItem = useCallback(
    (item) => setDraft((d) => ({ ...d, items: [...d.items, { ...item, key: newRef() }] })),
    []
  );
  const updateItem = useCallback(
    (key, patch) => setDraft((d) => ({ ...d, items: d.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) })),
    []
  );
  const removeItem = useCallback((key) => {
    setDraft((d) => {
      discardVoice(d.items.find((it) => it.key === key)?.voice);
      return { ...d, items: d.items.filter((it) => it.key !== key) };
    });
  }, []);
  const setField = useCallback((field, value) => setDraft((d) => ({ ...d, [field]: value })), []);

  // After sending: forget the draft but keep the chosen branch for next time.
  const reset = useCallback(() => setDraft((d) => emptyDraft(d.branchId)), []);

  const clear = useCallback(() => {
    setDraft((d) => {
      d.items.forEach((it) => discardVoice(it.voice));
      discardVoice(d.voice);
      return emptyDraft(d.branchId);
    });
  }, []);

  // "Order again": the old order's items become the new draft (without voice messages).
  const loadFromOrder = useCallback((order) => {
    setDraft((d) => {
      d.items.forEach((it) => discardVoice(it.voice));
      discardVoice(d.voice);
      return {
        ...emptyDraft(order.branch.id),
        items: order.items.map((it) => ({
          key: newRef(),
          productId: it.productId,
          name: it.name,
          unit: it.unit,
          quantity: it.quantity,
          note: it.note,
          voice: null,
        })),
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      draft: { ...draft, branchId },
      itemCount: draft.items.length,
      isEmpty: draft.items.length === 0 && !draft.note && !draft.voice,
      addItem, updateItem, removeItem, setField, reset, clear, loadFromOrder,
    }),
    [draft, branchId, addItem, updateItem, removeItem, setField, reset, clear, loadFromOrder]
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export const useDraft = () => useContext(DraftContext);
