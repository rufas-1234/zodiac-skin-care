"use client";

import { useState } from 'react';

import { BrandLogo } from '@/components/brand-logo';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(challengeToken
          ? { challengeToken, code: verificationCode }
          : { email, password }),
      });

      const payload = await response.json() as {
        error?: string;
        twoFactorRequired?: boolean;
        challengeToken?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to sign in.');
      }

      if (payload.twoFactorRequired && payload.challengeToken) {
        setChallengeToken(payload.challengeToken);
        setNotice(payload.message || 'Check your email for a verification code.');
        setSubmitting(false);
        return;
      }

      window.location.href = '/admin';
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
      setSubmitting(false);
    }
  };

  return (
    <div className="container-shell flex min-h-[70vh] items-center justify-center py-10 sm:py-16">
      <div className="w-full max-w-md rounded-[24px] border border-[#f0dfda] bg-white p-6 shadow-[0_18px_50px_rgba(56,42,42,0.06)] sm:rounded-[30px] sm:p-8">
        <BrandLogo className="mb-5 h-16 w-[176px]" />
        <p className="text-[10px] uppercase tracking-[0.34em] text-[#b87580]">Admin access</p>
        <h1 className="mt-3 font-serif text-4xl text-[#382a2a]">Sign in</h1>
        <p className="mt-2 text-sm text-[#5d4c4b]">Use the secure admin account to manage products and website content.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {challengeToken ? (
            <>
              <p className="text-sm leading-6 text-[#5d4c4b]">Enter the six-digit code sent to your administrator email. The code expires in 10 minutes.</p>
              <label className="block space-y-2">
                <span className="text-sm text-[#382a2a]">Email verification code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-2xl border border-[#eadcdf] bg-[#fff] px-4 py-3 text-lg tracking-[0.3em] text-[#382a2a] outline-none focus:border-[#b87580]"
                  required
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setChallengeToken('');
                  setVerificationCode('');
                  setNotice('');
                  setError('');
                }}
                className="text-sm text-[#9b626d] underline underline-offset-4"
              >
                Use a different account
              </button>
            </>
          ) : (
            <>
              <label className="block space-y-2">
                <span className="text-sm text-[#382a2a]">Email</span>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-[#eadcdf] bg-[#fff] px-4 py-3 text-[#382a2a] outline-none focus:border-[#b87580]"
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-[#382a2a]">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-[#eadcdf] bg-[#fff] px-4 py-3 text-[#382a2a] outline-none focus:border-[#b87580]"
                  required
                />
              </label>
            </>
          )}
          {notice ? <p role="status" className="text-sm text-[#356a49]">{notice}</p> : null}
          {error ? <p className="text-sm text-[#b87580]">{error}</p> : null}

          <button type="submit" disabled={submitting} className="w-full rounded-full bg-[#382a2a] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#b87580] disabled:cursor-not-allowed disabled:opacity-70">
            {submitting ? 'Signing in...' : challengeToken ? 'Verify and sign in' : 'Login'}
          </button>
        </form>

      </div>
    </div>
  );
}
