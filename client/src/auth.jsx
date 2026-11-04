import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { useI18n } from './i18n/index.jsx';
import { detachPush, resyncPush } from './lib/push.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { setLang } = useI18n();
  const [state, setState] = useState({ loading: true, user: null, needsSetup: false, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [setup, me] = await Promise.all([api('/setup/status'), api('/auth/me')]);
      setState({ loading: false, user: me.user, needsSetup: setup.needsSetup, error: null });
      if (me.user) setLang(me.user.language);
    } catch (err) {
      setState({ loading: false, user: null, needsSetup: false, error: err.code });
    }
  }, [setLang]);

  useEffect(() => {
    load();
  }, [load]);

  // A request came back 401 (session ended elsewhere, e.g. PIN reset): show the login screen.
  useEffect(() => {
    const onLoggedOut = () => setState((s) => ({ ...s, user: null }));
    window.addEventListener('srj:logged-out', onLoggedOut);
    return () => window.removeEventListener('srj:logged-out', onLoggedOut);
  }, []);

  const signedIn = useCallback(
    (user) => {
      setState((s) => ({ ...s, user, needsSetup: false }));
      setLang(user.language);
      resyncPush();
    },
    [setLang]
  );

  const logout = useCallback(async () => {
    await detachPush();
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setState((s) => ({ ...s, user: null }));
  }, []);

  const updateUser = useCallback((user) => setState((s) => ({ ...s, user })), []);

  return (
    <AuthContext.Provider value={{ ...state, reload: load, signedIn, logout, updateUser }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const homePath = (role) =>
  ({ admin: '/admin', warehouse: '/warehouse', owner: '/order', staff: '/order' })[role] || '/';
