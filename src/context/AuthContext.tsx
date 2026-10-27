/**
 * Production Firebase Authentication Context
 * DOCUAGENT AI
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  auth,
  onAuthStateChanged,
  FirebaseUser,
  signInWithGoogle,
  signInWithMicrosoft,
  signInWithGithub,
  signInEmailPassword,
  signUpEmailPassword,
  sendPasswordReset,
  logOut,
  getCurrentIdToken,
  formatAuthError
} from '../lib/firebase.ts';
import { UserSession } from '../components/Navbar.tsx';
import { syncSessionCookie } from '../lib/authInterceptor.ts';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userSession: UserSession | null;
  loading: boolean;
  authError: { title: string; message: string; isConfigNotice?: boolean } | null;
  clearAuthError: () => void;
  signInGoogle: () => Promise<void>;
  signInMicrosoft: () => Promise<void>;
  signInGithub: () => Promise<void>;
  signInEmail: (email: string, pass: string, rememberMe?: boolean) => Promise<void>;
  signUpEmail: (email: string, pass: string, fullName: string) => Promise<void>;
  signInDemo: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  idToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [idToken, setIdToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('docuagent_session_token');
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<{ title: string; message: string; isConfigNotice?: boolean } | null>(null);

  // Map Firebase user to DOCUAGENT user session
  const mapFirebaseToSession = useCallback((fbUser: FirebaseUser): UserSession => {
    const email = fbUser.email || 'user@docuagent.local';
    const isEnterpriseAdmin = email.endsWith('@docuagent.local') && (email.includes('admin') || email.includes('lead'));
    const isAuditor = email.includes('auditor') || email.includes('compliance');
    const role: UserSession['role'] = isEnterpriseAdmin ? 'admin' : isAuditor ? 'viewer' : 'reviewer';

    return {
      user_id: fbUser.uid,
      email,
      role,
      full_name: fbUser.displayName || email.split('@')[0]
    };
  }, []);

  // Listen to Firebase auth state changes or restore cached session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setCurrentUser(fbUser);
        setUserSession(mapFirebaseToSession(fbUser));
        try {
          const token = await fbUser.getIdToken();
          setIdToken(token);
          syncSessionCookie(token);
          try {
            localStorage.setItem('docuagent_session_token', token);
          } catch {}
        } catch {
          setIdToken(null);
          syncSessionCookie(null);
        }
        setLoading(false);
      } else {
        // If not logged in with Firebase, check for cached local session or demo token
        const cachedToken = (() => {
          try {
            return localStorage.getItem('docuagent_session_token');
          } catch {
            return null;
          }
        })();

        if (cachedToken) {
          try {
            const res = await fetch('/api/auth/me', {
              headers: {
                'Authorization': `Bearer ${cachedToken}`,
                'X-Session-Token': cachedToken
              },
              credentials: 'include'
            });
            if (res.ok) {
              const data = await res.json();
              if (data.authenticated && data.user) {
                const u = data.user;
                setUserSession({
                  user_id: u.userId,
                  email: u.email,
                  role: u.role,
                  full_name: u.name
                });
                setCurrentUser({
                  uid: u.userId,
                  email: u.email,
                  displayName: u.name
                } as any);
                setIdToken(cachedToken);
                setLoading(false);
                return;
              }
            }
          } catch {}
        }

        setCurrentUser(null);
        setUserSession(null);
        setIdToken(null);
        syncSessionCookie(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [mapFirebaseToSession]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const signInGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setAuthError(formatAuthError(err));
      throw err;
    }
  };

  const signInMicrosoft = async () => {
    setAuthError(null);
    try {
      await signInWithMicrosoft();
    } catch (err: any) {
      setAuthError(formatAuthError(err));
      throw err;
    }
  };

  const signInGithub = async () => {
    setAuthError(null);
    try {
      await signInWithGithub();
    } catch (err: any) {
      setAuthError(formatAuthError(err));
      throw err;
    }
  };

  const signInEmail = async (email: string, pass: string, rememberMe: boolean = true) => {
    setAuthError(null);
    try {
      await signInEmailPassword(email, pass, rememberMe);
    } catch (firebaseErr: any) {
      // If Firebase auth throws user-not-found or invalid credentials, attempt local backend auth
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: email.trim(), password: pass })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.token && data.user) {
            const u = data.user;
            setIdToken(data.token);
            try {
              localStorage.setItem('docuagent_session_token', data.token);
            } catch {}
            setUserSession({
              user_id: u.userId,
              email: u.email,
              role: u.role,
              full_name: u.name
            });
            setCurrentUser({
              uid: u.userId,
              email: u.email,
              displayName: u.name
            } as any);
            syncSessionCookie(data.token);
            return;
          }
        }
      } catch {}

      setAuthError(formatAuthError(firebaseErr));
      throw firebaseErr;
    }
  };

  const signInDemo = async () => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Demo authentication failed');
      const data = await res.json();
      if (data.token && data.user) {
        const u = data.user;
        setIdToken(data.token);
        try {
          localStorage.setItem('docuagent_session_token', data.token);
        } catch {}
        setUserSession({
          user_id: u.userId,
          email: u.email,
          role: u.role,
          full_name: u.name
        });
        setCurrentUser({
          uid: u.userId,
          email: u.email,
          displayName: u.name
        } as any);
        syncSessionCookie(data.token);
      }
    } catch (err: any) {
      setAuthError({
        title: 'Demo Access Notice',
        message: 'Could not initialize demo reviewer session. Using offline sandbox mode.'
      });
      // Fallback local session state
      setIdToken('demo-reviewer-token');
      try {
        localStorage.setItem('docuagent_session_token', 'demo-reviewer-token');
      } catch {}
      setUserSession({
        user_id: 'usr-reviewer-01',
        email: 'reviewer@docuagent.local',
        role: 'reviewer',
        full_name: 'Lead Reviewer Morgan'
      });
      setCurrentUser({
        uid: 'usr-reviewer-01',
        email: 'reviewer@docuagent.local',
        displayName: 'Lead Reviewer Morgan'
      } as any);
    }
  };

  const signUpEmail = async (email: string, pass: string, fullName: string) => {
    setAuthError(null);
    try {
      await signUpEmailPassword(email, pass, fullName);
    } catch (err: any) {
      setAuthError(formatAuthError(err));
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordReset(email);
    } catch (err: any) {
      setAuthError(formatAuthError(err));
      throw err;
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    try {
      await logOut();
      syncSessionCookie(null);
      try {
        localStorage.removeItem('docuagent_session_token');
        localStorage.removeItem('docuagent_active_tab');
        localStorage.removeItem('docuagent_selected_case');
        localStorage.removeItem('docuagent_redirect_target');
      } catch {}
    } catch (err: any) {
      console.error('[FirebaseAuth] Logout error:', err);
    } finally {
      setCurrentUser(null);
      setUserSession(null);
      setIdToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userSession,
        loading,
        authError,
        clearAuthError,
        signInGoogle,
        signInMicrosoft,
        signInGithub,
        signInEmail,
        signUpEmail,
        signInDemo,
        resetPassword,
        signOutUser,
        idToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
