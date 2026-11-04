import crypto from 'node:crypto';

export const ROLES = ['admin', 'warehouse', 'owner', 'staff'];
export const TEAM_ROLES = ['admin', 'warehouse'];
export const CUSTOMER_ROLES = ['owner', 'staff'];
export const LANGUAGES = ['de', 'en', 'hi'];

// `code` is a short key the client translates (see client/src/i18n, "errors").
export class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export const cleanStr = (value, maxLength = 200) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

// Accepts German-style input ("0151 2345678", "+49 151 …", "0049…")
// and returns E.164 ("+491512345678"), or null if it is not a phone number.
export function normalizePhone(input) {
  let p = String(input ?? '').replace(/[\s\-/().]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  else if (p.startsWith('0')) p = '+49' + p.slice(1);
  else if (!p.startsWith('+')) p = (p.startsWith('49') && p.length >= 12 ? '+' : '+49') + p;
  return /^\+[1-9]\d{7,14}$/.test(p) ? p : null;
}

export const isValidPin = (pin) => /^\d{4}$/.test(String(pin ?? ''));

// Random 4-digit PIN, avoiding the most guessable ones (1111, 1234, 9876…).
export function generatePin() {
  for (;;) {
    const pin = String(crypto.randomInt(0, 10000)).padStart(4, '0');
    const weak = /^(\d)\1{3}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin);
    if (!weak) return pin;
  }
}
