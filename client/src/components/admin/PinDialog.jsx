import { useState } from 'react';
import { translate, useI18n } from '../../i18n/index.jsx';
import { Modal, formatPhone } from '../ui.jsx';

// Shows a freshly created PIN once, with a ready-made WhatsApp message
// written in the receiving user's own language.
export default function PinDialog({ user, pin, onClose }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const message = translate(user.language, 'pin.message', {
    name: user.name,
    url: window.location.origin,
    phone: formatPhone(user.phone),
    pin,
  });
  const whatsappUrl = `https://wa.me/${user.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal title={t('pin.title', { name: user.name })} onClose={onClose}>
      <div className="pin-display" aria-label={t('fields.pin')}>{pin}</div>
      <p className="muted small">{t('pin.info')}</p>
      <div className="stack">
        <a className="btn whatsapp block" href={whatsappUrl} target="_blank" rel="noreferrer">
          {t('pin.whatsapp')}
        </a>
        <button type="button" className="btn block" onClick={copy}>
          {copied ? t('pin.copied') : t('pin.copy')}
        </button>
        <button type="button" className="btn ghost block" onClick={onClose}>{t('common.done')}</button>
      </div>
    </Modal>
  );
}
