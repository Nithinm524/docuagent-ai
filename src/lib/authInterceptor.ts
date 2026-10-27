/**
 * Global HTTP Interceptor and Session Cookie Sync for Firebase ID Token
 * DOCUAGENT AI
 *
 * Ensures all outbound client API requests to `/api/*` automatically include
 * the current authenticated user's Firebase ID token via both:
 * 1. Secure `docuagent_session` cookie (compatible with environments where window.fetch has only a getter).
 * 2. Authorization: Bearer <idToken> header when supported.
 */

import { getCurrentIdToken } from './firebase.ts';

export const SESSION_COOKIE_NAME = 'docuagent_session';

let isInterceptorInstalled = false;

/**
 * Synchronizes the Firebase ID token to the document cookie so that all
 * browser HTTP requests automatically transmit credentials to the backend.
 */
export function syncSessionCookie(token: string | null) {
  if (typeof document === 'undefined') return;
  try {
    if (token) {
      document.cookie = `${SESSION_COOKIE_NAME}=${token}; path=/; max-age=3600; SameSite=Lax`;
    } else {
      document.cookie = `${SESSION_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    }
  } catch (err) {
    console.warn('[AuthInterceptor] Could not sync session cookie:', err);
  }
}

/**
 * Installs the auth interceptor. Defensively checks if `window.fetch` can be patched.
 * If `window.fetch` is getter-only (e.g. in certain iframe environments), it gracefully
 * falls back to automatic cookie-based transport without throwing.
 */
export function setupAuthInterceptor() {
  if (typeof window === 'undefined' || isInterceptorInstalled) return;
  isInterceptorInstalled = true;

  try {
    const originalFetch = window.fetch;
    if (typeof originalFetch !== 'function') return;

    // Check if window.fetch can be modified without throwing "Cannot set property fetch of #<Window> which has only a getter"
    let canPatch = false;
    try {
      const desc =
        Object.getOwnPropertyDescriptor(window, 'fetch') ||
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'fetch');
      if (desc ? desc.writable || !!desc.set : true) {
        canPatch = true;
      }
    } catch {
      canPatch = false;
    }

    if (!canPatch) {
      console.info('[AuthInterceptor] window.fetch is getter-only; using secure cookie-based token transport.');
      return;
    }

    // Attempt patching in a try/catch block
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const isApiRequest = urlString.startsWith('/api/') || urlString.startsWith('api/') || urlString === '/api';

      if (isApiRequest) {
        try {
          const idToken = await getCurrentIdToken();
          if (idToken) {
            syncSessionCookie(idToken);
            const headers = new Headers(
              init?.headers || (typeof input === 'object' && 'headers' in input ? (input as Request).headers : {})
            );
            if (!headers.has('Authorization')) {
              headers.set('Authorization', `Bearer ${idToken}`);
            }
            init = {
              ...init,
              headers
            };
          }
        } catch (err) {
          console.warn('[AuthInterceptor] Could not attach bearer token:', err);
        }
      }

      return originalFetch.call(this, input, init);
    };
  } catch (err) {
    console.info('[AuthInterceptor] Global fetch interceptor notice (using cookie transport):', err);
  }
}
