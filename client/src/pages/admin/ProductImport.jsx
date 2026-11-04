import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { invalidateCatalog } from '../../lib/catalog.js';
import { ErrorText, Field, Icon } from '../../components/ui.jsx';

const FIELDS = ['name', 'category', 'articleNo', 'unit'];
const CHUNK = 500;

// Guesses which column holds what, from German or English headers (and weclapp exports).
const GUESS = {
  articleNo: /art.*(nr|nummer|no)|artikelnummer|^nr\.?$|sku|ean|code|article.?(no|number)/i,
  category: /kategorie|warengruppe|artikelgruppe|gruppe|categor/i,
  unit: /einheit|^me$|gebinde|vpe|unit|verpackung/i,
  name: /bezeichnung|artikelname|name|produkt|artikel|beschreibung|description|product/i,
};

function guessMapping(headers) {
  const mapping = {};
  const used = new Set();
  for (const field of ['articleNo', 'category', 'unit', 'name']) {
    const index = headers.findIndex((h, i) => !used.has(i) && GUESS[field].test(String(h)));
    if (index !== -1) {
      mapping[field] = index;
      used.add(index);
    }
  }
  if (mapping.name === undefined) mapping.name = headers.findIndex((h, i) => !used.has(i));
  return mapping;
}

// Minimal CSV reader: detects ; , or tab and handles "quoted, values".
function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = [';', '\t', ','].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ';');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Excel on German Windows often saves CSV as Windows-1252, not UTF-8.
async function readText(file) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

async function readFile(file) {
  if (/\.csv$|\.txt$/i.test(file.name)) return parseCsv(await readText(file));
  const { readSheet } = await import('read-excel-file/browser');
  return readSheet(file);
}

export default function ProductImport() {
  const { t, te } = useI18n();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState(null); // includes the header row
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null); // { done, total }
  const [result, setResult] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setResult(null);
    setRows(null);
    setFileName(file.name);
    try {
      const data = (await readFile(file))
        .map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c).trim())))
        .filter((r) => r.some(Boolean));
      if (data.length < 2) throw new Error('empty');
      setRows(data);
      setMapping(guessMapping(data[0]));
    } catch {
      setError(t('import.readError'));
    }
  };

  const headers = rows?.[0] ?? [];
  const mapped = useMemo(() => {
    if (!rows) return [];
    return rows.slice(1).map((r) => Object.fromEntries(FIELDS.map((f) => [f, mapping[f] >= 0 ? r[mapping[f]] ?? '' : ''])));
  }, [rows, mapping]);
  const validCount = mapped.filter((r) => r.name).length;

  const runImport = async () => {
    setError('');
    const total = { created: 0, updated: 0, unchanged: 0, skipped: 0 };
    try {
      for (let i = 0; i < mapped.length; i += CHUNK) {
        setProgress({ done: i, total: mapped.length });
        const r = await api('/admin/products/import', { method: 'POST', body: { rows: mapped.slice(i, i + CHUNK) } });
        for (const k of Object.keys(total)) total[k] += r[k];
      }
      invalidateCatalog();
      setResult(total);
      setRows(null);
    } catch (err) {
      setError(te(err.code));
      if (Object.values(total).some(Boolean)) setResult(total);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="page">
      <Link to="/admin/products" className="back-link">
        <Icon name="back" size={18} /> {t('products.title')}
      </Link>
      <h1>{t('import.title')}</h1>

      <section className="card stack">
        <p>{t('import.intro')}</p>
        <ul className="muted small hint-list">
          <li>{t('import.hintColumns')}</li>
          <li>{t('import.hintUpdate')}</li>
          <li>{t('import.hintSafe')}</li>
        </ul>
        <label className="btn primary file-btn">
          <Icon name="upload" /> {fileName ? t('import.otherFile') : t('import.chooseFile')}
          <input type="file" accept=".xlsx,.csv,.txt" onChange={onFile} />
        </label>
        {fileName && <p className="muted small">{fileName}</p>}
        <ErrorText>{error}</ErrorText>
      </section>

      {result && (
        <section className="card success-card" role="status">
          <Icon name="check" size={28} />
          <div>
            <strong>{t('import.done')}</strong>
            <p>{t('import.result', result)}</p>
            <Link to="/admin/products">{t('import.toProducts')}</Link>
          </div>
        </section>
      )}

      {rows && (
        <>
          <section className="card stack">
            <h2>{t('import.columns')}</h2>
            <p className="muted small">{t('import.columnsHint')}</p>
            <div className="mapping-grid">
              {FIELDS.map((f) => (
                <Field key={f} label={t(`import.field.${f}`)}>
                  <select value={mapping[f] ?? -1} onChange={(e) => setMapping({ ...mapping, [f]: Number(e.target.value) })}>
                    <option value={-1}>— {t('import.notInFile')} —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `${t('import.column')} ${i + 1}`}</option>)}
                  </select>
                </Field>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>{t('import.preview', { count: validCount })}</h2>
            <div className="table-scroll">
              <table className="preview-table">
                <thead>
                  <tr>{FIELDS.map((f) => <th key={f}>{t(`import.field.${f}`)}</th>)}</tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 8).map((r, i) => (
                    <tr key={i} className={r.name ? '' : 'skipped'}>
                      {FIELDS.map((f) => <td key={f}>{r[f]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mapped.length > 8 && <p className="muted small">{t('import.more', { count: mapped.length - 8 })}</p>}
          </section>

          <button className="btn primary big" disabled={!validCount || progress || mapping.name < 0} onClick={runImport}>
            <Icon name="upload" />
            {progress ? t('import.importing', progress) : t('import.start', { count: validCount })}
          </button>
        </>
      )}
    </div>
  );
}
