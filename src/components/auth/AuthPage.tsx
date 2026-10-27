/**
 * Premium Authentication Portal
 * DOCUAGENT AI
 *
 * Implements:
 * - Full-screen immersive WebGL RippleTransition background
 * - Centered login portal (max-w-[440px]) without any unwanted top graphics or duplicate previews
 * - Real Firebase Authentication (Google, Microsoft, GitHub, Email/Password, Password Reset)
 * - Enterprise branding, accessible form inputs, and secure credential handling
 */

import React, { useState } from 'react';
import { RippleTransition } from "@/components/ui/ripple-transition";
import { useAuth } from '../../context/AuthContext.tsx';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface AuthPageProps {
  onSuccess: () => void;
  onOpenPage?: (page: 'privacy' | 'terms') => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot';

// High-fidelity document-intelligence assets for WebGL ripple transitions
const AUTH_SCENES = [
  "/images/docuagent-scene-1.jpg",
  "/images/docuagent-scene-2.jpg",
  "/images/docuagent-scene-3.jpg"
];

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess, onOpenPage }) => {
  const {
    signInGoogle,
    signInMicrosoft,
    signInGithub,
    signInEmail,
    signUpEmail,
    resetPassword,
    authError,
    clearAuthError
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Loading states
  const [submitting, setSubmitting] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  // Password reset success notice
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Form inline validation checks for Sign Up
  const hasMinLength = password.length >= 8;
  const hasUpperLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumberOrSymbol = /[\d\W_]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isSignUpValid =
    hasMinLength && hasUpperLower && hasNumberOrSymbol && passwordsMatch && fullName.trim().length > 0;

  // Handle Sign In submission
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || submitting) return;
    setSubmitting(true);
    clearAuthError();
    try {
      await signInEmail(email, password, rememberMe);
      onSuccess();
    } catch {
      // Error handled via AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Sign Up submission
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignUpValid || submitting) return;
    setSubmitting(true);
    clearAuthError();
    try {
      await signUpEmail(email, password, fullName);
      onSuccess();
    } catch {
      // Error handled via AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Password Reset submission
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || submitting) return;
    setSubmitting(true);
    clearAuthError();
    setResetSuccessMessage(null);
    try {
      await resetPassword(email);
      setResetSuccessMessage(
        `A password reset link has been dispatched to ${email}. Please check your inbox and follow the instructions.`
      );
    } catch {
      // Error handled via AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  // Handle OAuth Provider Sign In
  const handleOAuthSignIn = async (providerName: 'google' | 'microsoft' | 'github') => {
    if (submitting) return;
    setActiveProvider(providerName);
    setSubmitting(true);
    clearAuthError();
    try {
      if (providerName === 'google') await signInGoogle();
      else if (providerName === 'microsoft') await signInMicrosoft();
      else if (providerName === 'github') await signInGithub();
      onSuccess();
    } catch {
      // Error handled via AuthContext
    } finally {
      setSubmitting(false);
      setActiveProvider(null);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    clearAuthError();
    setResetSuccessMessage(null);
    setMode(newMode);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#030712] text-slate-100 overflow-x-hidden font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* 
        Full-Screen WebGL RippleTransition Background
        Covers the entire viewport with smooth ripple wave animations between technology visuals.
      */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <RippleTransition
          images={AUTH_SCENES}
          duration={1.4}
          ease="easeInOut"
          autoPlay={true}
          autoPlayInterval={5000}
          autoPlayOrigin="center"
          waveSpeed={1.6}
          sigma={0.15}
          waveFreq={5}
          pushAmt={0.145}
          caStrength={0.02}
          glow={0.73}
          noiseWarp={1}
          pinch={false}
          borderRadius={0}
          background="#030712"
          label="DOCUAGENT AI animated login background"
          className="absolute inset-0 h-full w-full"
        />

        {/* Deep navy/black frosted overlay and radial vignette to ensure pristine contrast */}
        <div className="absolute inset-0 bg-[#030712]/75 dark:bg-[#030712]/80 backdrop-blur-[1px] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-[#030712]/85 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_#030712_92%)] pointer-events-none" />

        {/* Subtle Cyan and Teal Ambient Glow Highlights */}
        <div className="absolute top-1/4 left-1/3 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/3 translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 
        Foreground Centered Login Portal Container
        Horizontally and vertically centered without any unwanted top graphics or duplicate preview cards.
      */}
      <div className="relative z-10 w-full max-w-[440px] mx-auto my-auto flex flex-col items-center justify-center">
        {/* Main Frosted Glass Authentication Card */}
        <div className="w-full rounded-3xl border border-slate-700/60 dark:border-slate-800/80 bg-slate-950/85 dark:bg-[#070b16]/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/40 transition-all">
          
          {/* Brand Section */}
          <div className="space-y-3.5 text-center pb-5 border-b border-slate-800/80">
            {/* Logo and Wordmark */}
            <div className="flex items-center justify-center space-x-2.5">
              <div className="flex items-center justify-center rounded-xl bg-slate-900/90 p-1.5 border border-slate-700/80 shadow-md shadow-cyan-500/10">
                <picture className="flex items-center">
                  <source type="image/webp" srcSet="/docuagent-logo.webp" />
                  <img
                    src="/docuagent-logo.png"
                    alt="DOCUAGENT AI logo"
                    width={110}
                    height={26}
                    className="h-6 w-auto object-contain"
                  />
                </picture>
              </div>
              <span className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1">
                DOCUAGENT <span className="text-cyan-400 font-extrabold text-xs">AI</span>
              </span>
            </div>

            <div>
              <p className="text-xs text-slate-400 font-medium">
                Intelligent Document Review &amp; Screening
              </p>
              
              {/* Small, Tasteful Badge */}
              <div className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-[11px] font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Enterprise Identity Gate</span>
              </div>
            </div>
          </div>

          {/* Mode Headings & Content */}
          <div className="pt-5 space-y-4">
            {mode === 'signin' && (
              <div className="space-y-1 text-center">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Welcome back
                </h1>
                <p className="text-xs text-slate-400">
                  Sign in to continue to your workspace.
                </p>
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-1 text-center">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Create your account
                </h1>
                <p className="text-xs text-slate-400">
                  Join DOCUAGENT AI to review and screen documents.
                </p>
              </div>
            )}

            {mode === 'forgot' && (
              <div className="space-y-1 text-center">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Reset your password
                </h1>
                <p className="text-xs text-slate-400">
                  Enter your email address to receive password reset instructions.
                </p>
              </div>
            )}

            {/* Error Notification Alert */}
            {authError && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-start space-x-2.5 animate-fadeIn"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1 text-left">
                  <p className="font-semibold text-rose-100">{authError.title}</p>
                  <p className="text-[11px] leading-relaxed text-rose-300">{authError.message}</p>
                  {authError.isConfigNotice && (
                    <div className="pt-1 text-[10px] text-cyan-300 font-mono">
                      Tip: You can always use Google Sign-In or Email/Password.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reset Success Confirmation */}
            {resetSuccessMessage && (
              <div
                role="status"
                aria-live="polite"
                className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs flex items-start space-x-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1 text-left">
                  <p className="font-semibold text-emerald-100">Instructions Dispatched</p>
                  <p className="text-[11px] leading-relaxed text-emerald-300">{resetSuccessMessage}</p>
                </div>
              </div>
            )}

            {/* OAuth Provider Buttons (Sign-in & Sign-up) */}
            {mode !== 'forgot' && (
              <div className="space-y-2.5">
                {/* 1. Continue with Google */}
                <button
                  type="button"
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={submitting}
                  className="w-full relative group overflow-hidden px-4 py-2.5 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-850 hover:border-cyan-500/50 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-2.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform" />

                  {activeProvider === 'google' ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  ) : (
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.28-2.1 3.665-5.2 3.665-9.12z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.28v3.13C3.26 21.3 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.28C.46 8.2 0 10.04 0 12s.46 3.8 1.28 5.42l4-3.13z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.7 1.28 6.58l4 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
                      />
                    </svg>
                  )}
                  <span>Continue with Google</span>
                </button>

                {/* 2. Continue with Microsoft */}
                <button
                  type="button"
                  onClick={() => handleOAuthSignIn('microsoft')}
                  disabled={submitting}
                  className="w-full relative group overflow-hidden px-4 py-2.5 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-850 hover:border-cyan-500/50 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-2.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform" />

                  {activeProvider === 'microsoft' ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  ) : (
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23">
                      <path fill="#f35325" d="M1 1h10v10H1z" />
                      <path fill="#81bc06" d="M12 1h10v10H12z" />
                      <path fill="#05a6f0" d="M1 12h10v10H1z" />
                      <path fill="#ffba08" d="M12 12h10v10H12z" />
                    </svg>
                  )}
                  <span>Continue with Microsoft</span>
                </button>

                {/* 3. Continue with GitHub */}
                <button
                  type="button"
                  onClick={() => handleOAuthSignIn('github')}
                  disabled={submitting}
                  className="w-full relative group overflow-hidden px-4 py-2.5 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-850 hover:border-cyan-500/50 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-2.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform" />

                  {activeProvider === 'github' ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  ) : (
                    <svg className="w-4 h-4 shrink-0 fill-current text-white" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                  )}
                  <span>Continue with GitHub</span>
                </button>

                {/* Divider: OR CONTINUE WITH EMAIL */}
                <div className="relative py-2 flex items-center justify-center">
                  <div className="w-full border-t border-slate-800" />
                  <span className="absolute bg-[#070b16] px-3 text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    OR CONTINUE WITH EMAIL
                  </span>
                </div>
              </div>
            )}

            {/* Email Form: Sign In Mode */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-300 block">Work Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="reviewer@organization.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-900/90 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-700/80 bg-slate-900/90 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Session Checkbox */}
                <div className="flex items-center space-x-2 pt-1 text-left">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                  <label htmlFor="rememberMe" className="text-xs text-slate-400 cursor-pointer select-none">
                    Remember session on this device
                  </label>
                </div>

                {/* Primary Sign In Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-semibold text-xs tracking-wide shadow-md shadow-cyan-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  {submitting && activeProvider === null ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Switch to Sign Up */}
                <div className="text-center pt-2 text-xs text-slate-400">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer underline-offset-2 hover:underline"
                  >
                    Create an account
                  </button>
                </div>
              </form>
            )}

            {/* Email Form: Sign Up Mode */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-3.5 text-left">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Sarah Chen"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-900/90 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">Work Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="reviewer@organization.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-900/90 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-700/80 bg-slate-900/90 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">Confirm Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-700/80 bg-slate-900/90 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Inline Password Requirements Checklist */}
                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1 text-[11px]">
                  <div className="flex items-center space-x-1.5 text-slate-400">
                    <span className={hasMinLength ? 'text-emerald-400' : 'text-slate-500'}>
                      {hasMinLength ? '✓' : '•'}
                    </span>
                    <span className={hasMinLength ? 'text-emerald-300' : ''}>At least 8 characters</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-slate-400">
                    <span className={hasUpperLower ? 'text-emerald-400' : 'text-slate-500'}>
                      {hasUpperLower ? '✓' : '•'}
                    </span>
                    <span className={hasUpperLower ? 'text-emerald-300' : ''}>Uppercase and lowercase letters</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-slate-400">
                    <span className={hasNumberOrSymbol ? 'text-emerald-400' : 'text-slate-500'}>
                      {hasNumberOrSymbol ? '✓' : '•'}
                    </span>
                    <span className={hasNumberOrSymbol ? 'text-emerald-300' : ''}>Numbers or special symbols</span>
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <span className={passwordsMatch ? 'text-emerald-400' : 'text-rose-400'}>
                        {passwordsMatch ? '✓' : '✕'}
                      </span>
                      <span className={passwordsMatch ? 'text-emerald-300' : 'text-rose-300'}>
                        {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Terms and Privacy Policy Links */}
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  By creating an account, you agree to our{' '}
                  <button
                    type="button"
                    onClick={() => onOpenPage?.('terms')}
                    className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    Terms of Use
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => onOpenPage?.('privacy')}
                    className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  .
                </div>

                {/* Primary Create Account Button */}
                <button
                  type="submit"
                  disabled={!isSignUpValid || submitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-semibold text-xs tracking-wide shadow-md shadow-cyan-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  {submitting && activeProvider === null ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Switch to Sign In */}
                <div className="text-center pt-1 text-xs text-slate-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer underline-offset-2 hover:underline"
                  >
                    Sign in
                  </button>
                </div>
              </form>
            )}

            {/* Email Form: Forgot Password Mode */}
            {mode === 'forgot' && (
              <form onSubmit={handlePasswordReset} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">Registered Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="reviewer@organization.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-900/90 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !email}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-semibold text-xs tracking-wide shadow-md shadow-cyan-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send Password Reset Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                  >
                    &larr; Return to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Subtle, Non-Intrusive Footer Notice */}
        <div className="mt-5 text-center space-y-1 text-[11px] text-slate-400/80">
          <p>DOCUAGENT AI &middot; Assistive Document Intelligence Gate</p>
          <p className="text-slate-500">Protected by cryptographic token validation &middot; Authorized review required</p>
        </div>
      </div>
    </div>
  );
};
