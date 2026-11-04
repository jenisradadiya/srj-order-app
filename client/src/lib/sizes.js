// A product's sizes text ("2kg, 1kg, 500g" or "750ml | 500ml") turned into tap-able options.
// Texts that are a description rather than a list of choices
// ("Eckig | 214×149 mm | 43 mm | 928 cm³") give no options and are just shown as text.

const SIMPLE = /^(℮\s?)?\d+([.,]\d+)?\s?(ml|l|lit\.?|g|kg|oz)$|^(groß|klein)$/i;

export function sizeOptions(sizes) {
  const text = String(sizes || '').trim();
  if (!text) return [];
  if (text.includes('|')) {
    const parts = text.split('|').map((s) => s.trim()).filter(Boolean);
    return parts.every((p) => SIMPLE.test(p)) ? parts : [];
  }
  return text.split(/,\s+/).map((s) => s.trim()).filter(Boolean);
}

// Puts the chosen size at the front of the note, replacing a size chosen before,
// and keeps whatever else was typed (e.g. a brand).
export function applySize(note, size, options) {
  const parts = String(note || '').split(' · ').map((s) => s.trim()).filter(Boolean);
  if (parts.length && options.includes(parts[0])) parts.shift();
  return [size, ...parts].join(' · ');
}
