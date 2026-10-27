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
  resetPassword: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  idToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<{ title: string; message: string; isConfigNotice?: boolean } | null>(null);

  // Map Firebase user to DOCUAGENT user session
  const mapFirebaseToSession = useCallback((fbUser: FirebaseUser): UserSession => {
    const email = fbUser.email || 'user@docuagent.local';
    // Assign role: admin for enterprise domain or specific roles; reviewer default
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

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setCurrentUser(fbUser);
        setUserSession(mapFirebaseToSession(fbUser));
        try {
          const token = await fbUser.getIdToken();
          setIdToken(token);
          syncSessionCookie(token);
        } catch {
          setIdToken(null);
          syncSessionCookie(null);
        }
      } else {
        setCurrentUser(null);
        setUserSession(null);
        setIdToken(null);
        syncSessionCookie(null);
      }
      setLoading(false);
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
    } catch (err: any) {
      setAuthError(formatAuthError(err));
      throw err;
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
      // Remove any leftover session state
      localStorage.removeItem('docuagent_active_tab');
      localStorage.removeItem('docuagent_selected_case');
      localStorage.removeItem('docuagent_redirect_target');
    } catch (err: any) {
      console.error('[FirebaseAuth] Logout error:', err);
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
