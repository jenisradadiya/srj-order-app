import { useEffect, useRef, useState } from 'react';
import { uploadVoice, api } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { ErrorText, Icon } from './ui.jsx';

const MAX_SECONDS = 120;

const pickMime = () =>
  ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) =>
    window.MediaRecorder?.isTypeSupported?.(m)
  ) || '';

// The browser only allows the microphone on https:// or localhost.
const canRecord = () => Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

export const formatSeconds = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function VoicePlayer({ voice }) {
  if (!voice) return null;
  return <audio className="voice-player" controls preload="none" src={`/api/voice/${voice.id}`} />;
}

// Record (or pick) a voice message. value = { id, duration } | null.
export function VoiceRecorder({ value, onChange, label }) {
  const { t, te } = useI18n();
  const [state, setState] = useState('idle'); // idle | recording | uploading
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const recorder = useRef(null);
  const fileInput = useRef(null);

  // Stop the microphone if the screen is closed while recording.
  useEffect(() => () => recorder.current?.cancel(), []);

  const upload = async (blob, duration) => {
    setState('uploading');
    try {
      const voice = await uploadVoice(blob, duration);
      if (value) api(`/voice/${value.id}`, { method: 'DELETE' }).catch(() => {});
      onChange(voice);
    } catch (err) {
      setError(te(err.code));
    } finally {
      setState('idle');
    }
  };

  const start = async () => {
    setError('');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(t('voice.noPermission'));
      return;
    }
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    const startedAt = Date.now();
    let cancelled = false;
    const timer = setInterval(() => {
      const s = (Date.now() - startedAt) / 1000;
      setSeconds(s);
      if (s >= MAX_SECONDS) rec.stop();
    }, 250);
    const release = () => {
      clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
    };

    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      release();
      recorder.current = null;
      if (cancelled) return;
      const duration = (Date.now() - startedAt) / 1000;
      if (duration < 0.8) {
        setState('idle');
        setError(t('voice.tooShort'));
        return;
      }
      upload(new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' }), duration);
    };
    recorder.current = {
      stop: () => rec.state !== 'inactive' && rec.stop(),
      cancel: () => {
        cancelled = true;
        if (rec.state !== 'inactive') rec.stop();
        else release();
      },
    };
    setSeconds(0);
    setState('recording');
    rec.start(1000);
  };

  // Fallback when recording in the page is not possible (e.g. testing over http on a phone).
  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) return setError(te('voice_invalid'));
    if (file.size > 8 * 1024 * 1024) return setError(te('voice_too_large'));
    upload(file, 0);
  };

  const remove = () => {
    api(`/voice/${value.id}`, { method: 'DELETE' }).catch(() => {});
    onChange(null);
  };

  return (
    <div className="voice">
      {label && <span className="field-label">{label}</span>}

      {value && state === 'idle' && (
        <div className="voice-recorded">
          <VoicePlayer voice={value} />
          <button type="button" className="btn small danger" onClick={remove} aria-label={t('voice.delete')}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      )}

      {state === 'recording' && (
        <button type="button" className="btn voice-btn recording block" onClick={() => recorder.current?.stop()}>
          <span className="rec-dot" aria-hidden="true" /> {t('voice.stop')} · {formatSeconds(seconds)} / {formatSeconds(MAX_SECONDS)}
        </button>
      )}
      {state === 'uploading' && <p className="muted small">{t('voice.saving')}</p>}

      {state === 'idle' && (
        canRecord() ? (
          <button type="button" className="btn voice-btn block" onClick={start}>
            <Icon name="mic" /> {value ? t('voice.recordAgain') : t('voice.record')}
          </button>
        ) : (
          <>
            <button type="button" className="btn voice-btn block" onClick={() => fileInput.current.click()}>
              <Icon name="mic" /> {value ? t('voice.recordAgain') : t('voice.record')}
            </button>
            <input ref={fileInput} type="file" accept="audio/*" capture="user" hidden onChange={pickFile} />
          </>
        )
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
