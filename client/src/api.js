export class ApiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
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
