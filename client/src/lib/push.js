import { api } from '../api.js';

// Push notifications and "install app" helpers.

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// True when the app was opened from the home screen (installed).
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const pushSupported = () =>
  window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const permission = () => (window.Notification ? Notification.permission : 'unsupported');

function base64ToBytes(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function registerServiceWorker() {
  if (window.isSecureContext && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Asks for permission (if needed) and connects this phone to the logged-in user.
export async function enablePush() {
  const result = await Notification.requestPermission();
  if (result !== 'granted') throw new Error(result);
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await api('/push/key');
  // Start fresh, in case the server's keys changed since the last time.
  const old = await reg.pushManager.getSubscription();
  if (old) await old.unsubscribe().catch(() => {});
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) });
  await api('/push/subscribe', { method: 'POST', body: sub.toJSON() });
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

// After login: make sure this phone's notifications go to the person now logged in.
export async function resyncPush() {
  try {
    const sub = await currentSubscription();
    if (sub && permission() === 'granted') await api('/push/subscribe', { method: 'POST', body: sub.toJSON() });
  } catch {
    // Not important enough to bother the user.
  }
}

// Before logout: stop sending this person's notifications to this phone.
export async function detachPush() {
  try {
    const sub = await currentSubscription();
    if (sub) await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
  } catch {
    // Ignore.
  }
}

// The browser's "install this app" prompt (Android / desktop Chrome and Edge).
let installPrompt = null;
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    window.dispatchEvent(new Event('srj:installable'));
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    window.dispatchEvent(new Event('srj:installable'));
  });
}
export const canPromptInstall = () => Boolean(installPrompt);
export async function promptInstall() {
  if (!installPrompt) return false;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  installPrompt = null;
  return outcome === 'accepted';
}
