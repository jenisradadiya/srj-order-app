// Money is handled in cents everywhere, to avoid rounding errors.
// Amounts are always shown the German way ("1.234,56 €"), whatever the app
// language, so they look the same as on SRJ's Rechnungen.

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export const formatMoney = (cents) => euro.format((cents || 0) / 100);

// "1.234,56", "1234,56", "1234.56", "1 234,56 €" -> 123456. Returns NaN if it is not an amount.
export function parseMoney(text) {
  let s = String(text ?? '').replace(/[\s€]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}

// 123456 -> "1234,56" (for an input field)
export const centsToInput = (cents) => (cents ? (cents / 100).toFixed(2).replace('.', ',') : '');
