/**
 * Unified Authenticated Fetch Utility
 * DOCUAGENT AI
 *
 * Ensures all API calls securely attach authentication credentials via:
 * 1. Authorization: Bearer <token> (primary transport, immune to iframe cookie restrictions)
 * 2. X-Session-Token: <token> (header fallback)
 * 3. credentials: 'include' (cookie transport when allowed)
 * 4. Automatic sandbox/demo token acquisition if unauthenticated
 */

import { getCurrentIdToken } from '../lib/firebase.ts';

export const SESSION_STORAGE_KEY = 'docuagent_session_token';

/**
 * Retrieves the current authentication token from Firebase or local session cache
 */
export async function getAuthToken(): Promise<string | null> {
  // 1. Try Firebase Auth current ID token
  try {
    const fbToken = await getCurrentIdToken();
    if (fbToken) {
      return fbToken;
    }
  } catch {}

  // 2. Try localStorage cached session token (set by login or demo auth)
  try {
    const localToken = localStorage.getItem(SESSION_STORAGE_KEY);
    if (localToken && localToken.trim().length > 0) {
      return localToken.trim();
    }
  } catch {}

  // 3. Try reading session cookie
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)docuagent_session=([^;]*)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
}

/**
 * Ensures an active session token exists, auto-provisioning a demo reviewer token if needed.
 */
export async function ensureAuthToken(): Promise<string> {
  const existing = await getAuthToken();
  if (existing) {
    return existing;
  }

  // Auto-acquire sandbox reviewer session token
  try {
    const res = await fetch('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        try {
          localStorage.setItem(SESSION_STORAGE_KEY, data.token);
        } catch {}
        return data.token;
      }
    }
  } catch (err) {
    console.warn('[AuthFetch] Could not auto-acquire demo session token:', err);
  }

  // Fallback to hardcoded demo reviewer token recognized by server
  return 'demo-reviewer-token';
}

/**
 * Executes a fetch request with guaranteed authentication headers attached.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await ensureAuthToken();

  const headers = new Headers(init.headers || {});

  if (!headers.has('Authorization') && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('X-Session-Token') && token) {
    headers.set('X-Session-Token', token);
  }

  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials || 'include'
  });
}
