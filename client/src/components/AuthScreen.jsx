import { useI18n } from '../i18n/index.jsx';
import { LanguageSwitcher } from './ui.jsx';

// Centered card used by the login and first-setup screens.
export default function AuthScreen({ title, intro, children }) {
  const { lang, setLang } = useI18n();
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img src="/logo-stacked.svg" alt="SRJ" className="auth-logo" />
        <LanguageSwitcher value={lang} onChange={setLang} />
        <h1>{title}</h1>
        {intro && <p className="muted">{intro}</p>}
        {children}
      </div>
    </div>
  );
}
