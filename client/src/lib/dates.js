// Calendar dates as "YYYY-MM-DD" strings in the phone's local time (Germany).

const LOCALES = { de: 'de-DE', en: 'en-GB', hi: 'hi-IN' };
const pad = (n) => String(n).padStart(2, '0');

export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayStr = () => toDateStr(new Date());
export const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime());

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

// Monday of the week that contains s.
export const mondayOf = (s) => addDays(s, -((parseDate(s).getDay() + 6) % 7));

export const formatDay = (s, lang, options = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  parseDate(s).toLocaleDateString(LOCALES[lang] || 'en-GB', options);

// 1 = Monday … 7 = Sunday (1 Jan 2024 was a Monday)
export const weekdayName = (n, lang, style = 'long') =>
  new Date(2024, 0, n).toLocaleDateString(LOCALES[lang] || 'en-GB', { weekday: style });
