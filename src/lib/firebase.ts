/**
 * Firebase Client SDK Initialization & Authentication Services
 * DOCUAGENT AI
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  User as FirebaseUser,
  AuthError
} from 'firebase/auth';

// Read configuration provisioned by AI Studio Firebase integration
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize or retrieve existing app instance
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure OAuth Providers
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const microsoftProvider = new OAuthProvider('microsoft.com');
microsoftProvider.setCustomParameters({ prompt: 'select_account' });

export const githubProvider = new GithubAuthProvider();

/**
 * Configure authentication session persistence:
 * - Local persistence (rememberMe = true): survives browser restarts.
 * - Session persistence (rememberMe = false): cleared when the browser/tab is closed.
 */
export async function configurePersistence(rememberMe: boolean = true): Promise<void> {
  try {
    const persistenceMode = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistenceMode);
  } catch (err) {
    console.warn('[FirebaseAuth] Could not set persistence mode:', err);
  }
}

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle() {
  await configurePersistence(true);
  return await signInWithPopup(auth, googleProvider);
}

/**
 * Sign in with Microsoft Popup
 */
export async function signInWithMicrosoft() {
  await configurePersistence(true);
  return await signInWithPopup(auth, microsoftProvider);
}

/**
 * Sign in with GitHub Popup
 */
export async function signInWithGithub() {
  await configurePersistence(true);
  return await signInWithPopup(auth, githubProvider);
}

/**
 * Sign in with Email and Password
 */
export async function signInEmailPassword(email: string, pass: string, rememberMe: boolean = true) {
  await configurePersistence(rememberMe);
  return await signInWithEmailAndPassword(auth, email.trim(), pass);
}

/**
 * Sign up with Email, Password, and Full Name
 */
export async function signUpEmailPassword(email: string, pass: string, fullName: string) {
  await configurePersistence(true);
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (fullName && cred.user) {
    try {
      await updateProfile(cred.user, { displayName: fullName.trim() });
    } catch (err) {
      console.warn('[FirebaseAuth] Could not update profile displayName:', err);
    }
  }
  return cred;
}

/**
 * Send Password Reset Email
 */
export async function sendPasswordReset(email: string) {
  return await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Sign Out
 */
export async function logOut() {
  return await signOut(auth);
}

/**
 * Retrieve current user ID token (refreshed automatically if expiring)
 */
export async function getCurrentIdToken(forceRefresh: boolean = false): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  try {
    return await currentUser.getIdToken(forceRefresh);
  } catch (err) {
    console.error('[FirebaseAuth] Error retrieving ID token:', err);
    return null;
  }
}

/**
 * Formats Firebase auth error codes into helpful, actionable human messages
 */
export function formatAuthError(err: any): { title: string; message: string; isConfigNotice?: boolean } {
  if (!err) return { title: 'Authentication Failed', message: 'An unexpected error occurred. Please try again.' };

  const code: string = err.code || '';
  const rawMsg: string = err.message || '';

  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return {
        title: 'Invalid Credentials',
        message: 'The email address or password entered does not match our records. Please double-check your credentials.'
      };

    case 'auth/email-already-in-use':
      return {
        title: 'Account Already Exists',
        message: 'An account with this email address already exists. Please sign in or use the password reset link.'
      };

    case 'auth/weak-password':
      return {
        title: 'Password Too Weak',
        message: 'Your password must contain at least 8 characters, including uppercase, lowercase, numbers, and symbols.'
      };

    case 'auth/invalid-email':
      return {
        title: 'Invalid Email Address',
        message: 'Please provide a valid, well-formed email address (e.g., name@organization.com).'
      };

    case 'auth/popup-closed-by-user':
      return {
        title: 'Sign-in Cancelled',
        message: 'The authentication popup was closed before completing verification. Please click to try again.'
      };

    case 'auth/popup-blocked':
      return {
        title: 'Popup Blocked',
        message: 'Your browser prevented the authentication popup from opening. Please allow popups for this site and retry.'
      };

    case 'auth/account-exists-with-different-credential':
      return {
        title: 'Account Link Required',
        message: 'An account already exists with the same email address using a different sign-in method. Please sign in using your original provider.'
      };

    case 'auth/network-request-failed':
      return {
        title: 'Network Connection Issue',
        message: 'Unable to reach the authentication service. Please check your internet connection and try again.'
      };

    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return {
        title: 'Provider Activation Notice',
        message: 'This sign-in provider has not yet been activated in the Firebase Console. Please activate it under Firebase Authentication > Sign-in method, or sign in with Google or Email.',
        isConfigNotice: true
      };

    case 'auth/too-many-requests':
      return {
        title: 'Access Temporarily Suspended',
        message: 'Access to this account has been temporarily disabled due to multiple failed login attempts. Please wait a few moments or reset your password.'
      };

    default:
      if (rawMsg.includes('popup')) {
        return {
          title: 'Sign-in Cancelled',
          message: 'The sign-in popup was dismissed. Please click your desired sign-in method to try again.'
        };
      }
      return {
        title: 'Authentication Error',
        message: rawMsg || 'Unable to authenticate at this time. Please try again.'
      };
  }
}

export { onAuthStateChanged };
export type { FirebaseUser };
