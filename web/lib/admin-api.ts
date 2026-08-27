'use client';
import { API_URL } from './api';

export class AdminApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function adminRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('content-type', 'application/json');
  const response = await fetch(`${API_URL}/api/admin${path}`, { ...init, headers, credentials: 'include' });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: any; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new AdminApiError(response.status, data?.error || `HTTP ${response.status}`);
  return data as T;
}

export const adminJson = <T,>(path: string, method: string, body: unknown) => adminRequest<T>(path, { method, body: JSON.stringify(body) });

export async function uploadAdminImage(file: File) {
  const body = new FormData(); body.append('file', file);
  return adminRequest<{ url: string; name: string; size: number }>('/uploads', { method: 'POST', body });
}
