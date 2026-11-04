export class ApiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

// Uploads a recording (raw audio body). Returns { id, duration }.
export async function uploadVoice(blob, duration) {
  let res;
  try {
    res = await fetch('/api/voice', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': blob.type || 'audio/webm', 'X-Duration': String(Math.round(duration * 10) / 10) },
      body: blob,
    });
  } catch {
    throw new ApiError('network', 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error || (res.status === 413 ? 'voice_too_large' : 'server_error'), res.status);
  return data;
}

// Uploads a Rechnung PDF (admin). Returns { fileId }.
export async function uploadPdf(file) {
  let res;
  try {
    res = await fetch('/api/admin/invoice-files', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/pdf' },
      body: file,
    });
  } catch {
    throw new ApiError('network', 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error || (res.status === 413 ? 'pdf_too_large' : 'server_error'), res.status);
  return data;
}

// Small fetch wrapper. Errors carry a `code` the UI translates via errors.<code>.
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('network', 0);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('srj:logged-out'));
    throw new ApiError(data?.error || 'server_error', res.status);
  }
  return data;
}
