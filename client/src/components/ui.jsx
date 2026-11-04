import { useEffect, useId } from 'react';
import { useI18n, LANGUAGES } from '../i18n/index.jsx';

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  store: 'M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  box: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M9 18l6-6-6-6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  key: 'M15 7a2 2 0 0 1 2 2M21 9a6 6 0 0 1-7.74 5.74L11 17H9v2H7v2H3v-3.59l6.26-6.26A6 6 0 1 1 21 9z',
  pin: 'M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z',
  close: 'M18 6 6 18M6 6l12 12',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
};

export function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function PinInput({ value, onChange, autoComplete = 'current-password', autoFocus }) {
  return (
    <input
      className="pin-input"
      type="password"
      inputMode="numeric"
      pattern="[0-9]{4}"
      maxLength={4}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      required
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
    />
  );
}

export function ErrorText({ children }) {
  return children ? <p className="error" role="alert">{children}</p> : null;
}

export function Modal({ title, onClose, children }) {
  const { t } = useI18n();
  const titleId = useId();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LanguageSwitcher({ value, onChange }) {
  return (
    <div className="segmented" role="group" aria-label="Language">
      {LANGUAGES.map((l) => (
        <button key={l.code} type="button" className={l.code === value ? 'active' : ''} aria-pressed={l.code === value}
          onClick={() => onChange(l.code)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

// Shows "+491511234567" as "+49 151 1234567".
export function formatPhone(phone) {
  if (!phone) return '';
  const m = phone.match(/^\+49(1\d{2})(\d+)$/);
  return m ? `+49 ${m[1]} ${m[2]}` : phone;
}

export function Spinner() {
  const { t } = useI18n();
  return <div className="spinner" role="status" aria-label={t('common.loading')} />;
}
