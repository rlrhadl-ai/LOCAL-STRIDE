'use client';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
export const mediaUrl = (url?: string | null) => !url ? '' : url.startsWith('/uploads/') ? `${API_URL}${url}` : url;

/** 익명 기기 ID — 2단계에서 카카오 로그인 세션으로 대체 */
export function deviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('ls_device');
  if (!id) { id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`); localStorage.setItem('ls_device', id); }
  return id;
}

export class ApiError extends Error { constructor(public status: number, message: string, public body?: unknown) { super(message); } }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, { method, credentials: 'include', headers: { 'content-type': 'application/json', 'x-device-id': deviceId() }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `HTTP ${res.status}`, data);
  return data as T;
}
export const api = {
  get: <T,>(path: string) => request<T>('GET', path),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T,>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
};
