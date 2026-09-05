'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import { syncUserWithBackend } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      if (!auth || !googleProvider) {
        throw new Error(
          'Firebase Auth is not initialized yet. Please add your Firebase credentials to frontend/.env.local or use Quick Demo Login.'
        );
      }
      // 1. Firebase Google OAuth Popup
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      if (!firebaseUser.email) {
        throw new Error('No email found for this Google account.');
      }

      // 2. Synchronize with MySQL backend
      const res = await syncUserWithBackend({
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        avatarUrl: firebaseUser.photoURL || undefined,
        googleId: firebaseUser.uid,
      });

      if (res.success && res.user) {
        localStorage.setItem('reachinbox_user', JSON.stringify(res.user));
        router.push('/');
      } else {
        throw new Error('Failed to sync user with database');
      }
    } catch (err: any) {
      console.warn('Firebase Google Auth error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(
          'This domain is not authorized in Firebase yet. Please add your Vercel URL to Authorized Domains in Firebase Console (Authentication > Settings > Authorized Domains).'
        );
      } else if (
        err.code === 'auth/configuration-not-found' ||
        err.code === 'auth/invalid-api-key' ||
        !process.env.NEXT_PUBLIC_FIREBASE_API_KEY
      ) {
        setError('Firebase credentials not configured yet in environment variables.');
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Failed to login with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('Email/password login is disabled. Please use "Login with Google".');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center px-4">
      {/* Centered Login Card matching Figma Image 1 */}
      <div className="w-full max-w-sm border border-gray-100 rounded-3xl p-8 shadow-sm flex flex-col items-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Login</h1>

        {error && (
          <div className="w-full mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl leading-relaxed">
            {error}
          </div>
        )}

        {/* Real Google OAuth Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center space-x-2.5 py-2.5 px-4 bg-[#e8f8f0] text-[#008844] hover:bg-[#d6f3e4] rounded-xl font-semibold text-sm transition shadow-xs disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{loading ? 'Signing in...' : 'Login with Google'}</span>
        </button>

        {/* Divider */}
        <div className="w-full flex items-center my-6">
          <div className="flex-1 border-t border-gray-100" />
          <span className="px-3 text-xs text-gray-400 font-normal">or sign up through email</span>
          <div className="flex-1 border-t border-gray-100" />
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailLogin} className="w-full space-y-3">
          <div>
            <input
              type="email"
              placeholder="Email ID"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-green-500 transition"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-green-500 transition"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-[#00aa55] hover:bg-[#009248] text-white font-semibold rounded-xl text-sm transition shadow-sm"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
