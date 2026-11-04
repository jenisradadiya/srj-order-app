import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { ErrorText, Field, Icon, Modal } from './ui.jsx';
import { VoiceRecorder } from './Voice.jsx';
import { applySize, sizeOptions } from '../lib/sizes.js';

// Turns "2,5" or "2.5" into 2.5; returns NaN for anything else.
const parseQty = (text) => Number(String(text).replace(',', '.').trim());

export function QuantityStepper({ value, onChange }) {
  const { t } = useI18n();
  const step = (delta) => {
    const current = parseQty(value);
    const next = Math.max(1, Math.round(((Number.isFinite(current) ? current : 0) + delta) * 100) / 100);
    onChange(String(next).replace('.', ','));
  };
  return (
    <div className="stepper">
      <button type="button" className="stepper-btn" onClick={() => step(-1)} aria-label={t('item.less')}>−</button>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
        aria-label={t('item.quantity')} onFocus={(e) => e.target.select()} />
      <button type="button" className="stepper-btn" onClick={() => step(1)} aria-label={t('item.more')}>+</button>
    </div>
  );
}

// Add or edit one line of the order: quantity, note (brand/size) and an optional voice message.
// For a free item ("other item") the name is typed in.
export default function ItemSheet({ product, item, custom, existingLines = [], onSave, onRemove, onClose }) {
  const { t } = useI18n();
  const [name, setName] = useState(item?.name ?? '');
  const [qty, setQty] = useState(String(item?.quantity ?? 1).replace('.', ','));
  const [note, setNote] = useState(item?.note ?? '');
  const [voice, setVoice] = useState(item?.voice ?? null);
  const [error, setError] = useState('');

  const isCustom = custom || (item && !item.productId);
  const title = isCustom ? (item ? t('item.editCustom') : t('item.addCustom')) : (product?.name ?? item?.name);
  const unit = product?.unit ?? item?.unit ?? '';
  const sizes = product?.sizes ?? item?.sizes ?? '';
  const options = sizeOptions(sizes);
  const chosenSize = options.find((o) => note.split(' · ')[0].trim() === o);

  const save = (e) => {
    e.preventDefault();
    const quantity = Math.round(parseQty(qty) * 100) / 100;
    if (!(quantity > 0) || quantity > 10000) return setError(t('errors.invalid_quantity'));
    if (isCustom && !name.trim()) return setError(t('errors.item_name_required'));
    onSave({
      productId: isCustom ? null : (product?.id ?? item.productId),
      name: isCustom ? name.trim() : (product?.name ?? item.name),
      unit,
      sizes,
      quantity,
      note: note.trim(),
      voice,
    });
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        {existingLines.length > 0 && (
          <p className="notice small">
            {t('item.alreadyInCart')}{' '}
            {existingLines.map((l) => `${String(l.quantity).replace('.', ',')}${l.unit ? ' ' + l.unit : ''}${l.note ? ` (${l.note})` : ''}`).join(' · ')}
          </p>
        )}
        {isCustom && (
          <Field label={t('item.customName')}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('item.customNamePlaceholder')} autoFocus />
          </Field>
        )}
        {options.length > 0 && (
          <div className="field">
            <span className="field-label">{t('item.size')}</span>
            <div className="chip-row size-chips" role="group" aria-label={t('item.size')}>
              {options.map((o) => (
                <button type="button" key={o} className={`chip ${chosenSize === o ? 'selected' : ''}`} aria-pressed={chosenSize === o}
                  onClick={() => setNote(applySize(note, o, options))}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}
        {options.length === 0 && sizes && <p className="muted small">{sizes}</p>}
        <Field label={unit ? `${t('item.quantity')} (${unit})` : t('item.quantity')}>
          <QuantityStepper value={qty} onChange={setQty} />
        </Field>
        <Field label={t('item.note')}>
          <textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('item.notePlaceholder')} />
        </Field>
        <VoiceRecorder label={t('item.voice')} value={voice} onChange={setVoice} />
        <ErrorText>{error}</ErrorText>
        <div className="actions">
          {onRemove && (
            <button type="button" className="btn danger" onClick={onRemove}>
              <Icon name="trash" size={18} /> {t('common.delete')}
            </button>
          )}
          <button className="btn primary grow">
            {item ? t('common.save') : <><Icon name="plus" size={18} /> {t('item.add')}</>}
          </button>
        </div>
      </form>
    </Modal>
  );
}
