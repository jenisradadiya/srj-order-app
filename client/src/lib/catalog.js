import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

// "Bäsmati-Reis" and "basmati reis" should find each other.
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Every word typed must appear somewhere in the name.
export function searchProducts(products, query, limit = 100) {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const results = [];
  for (const p of products) {
    p._search ??= normalize(p.name);
    if (words.every((w) => p._search.includes(w))) {
      results.push(p);
      if (results.length >= limit) break;
    }
  }
  return results;
}

let cache = null; // { data, loadedAt }
const MAX_AGE = 10 * 60 * 1000;

// Loads the full catalog once and keeps it for 10 minutes.
export function useCatalog() {
  const [state, setState] = useState(() => ({ data: cache?.data ?? null, error: null }));

  const load = useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cache.loadedAt < MAX_AGE) {
      setState({ data: cache.data, error: null });
      return;
    }
    try {
      const data = await api('/catalog');
      data.productById = new Map(data.products.map((p) => [p.id, p]));
      cache = { data, loadedAt: Date.now() };
      setState({ data, error: null });
    } catch (err) {
      setState((s) => ({ ...s, error: err.code }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: () => load(true) };
}

export const invalidateCatalog = () => {
  cache = null;
};
