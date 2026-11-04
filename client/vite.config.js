import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:phone` serves over https so phones on the Wi-Fi may use the
// microphone (browsers only allow it on https). The phone shows a certificate
// warning once: tap "Advanced" -> "Continue".
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  server: {
    host: true, // reachable from phones on the same Wi-Fi
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
}));
