"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogOut, PackageCheck, Save, ShieldCheck, UserRound } from 'lucide-react';

import type { CustomerAccount, CustomerOrder } from '@/lib/customer-types';

function prettyStatus(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AccountPage() {
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [authMethod, setAuthMethod] = useState<'phone' | 'username'>('phone');
  const [passwordAction, setPasswordAction] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [phoneLinkValue, setPhoneLinkValue] = useState('');
  const [phoneLinkCode, setPhoneLinkCode] = useState('');
  const [phoneLinkCodeSent, setPhoneLinkCodeSent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    async function loadAccount() {
      try {
        const accountResponse = await fetch('/api/customer/account', { cache: 'no-store' });
        if (accountResponse.status === 401) return;
        const accountPayload = await accountResponse.json() as { customer?: CustomerAccount; error?: string };
        if (!accountResponse.ok || !accountPayload.customer) {
          throw new Error(accountPayload.error || 'Unable to load your account.');
        }
        const ordersResponse = await fetch('/api/customer/orders', { cache: 'no-store' });
        const ordersPayload = await ordersResponse.json() as { orders?: CustomerOrder[]; error?: string };
        if (!ordersResponse.ok || !ordersPayload.orders) {
          throw new Error(ordersPayload.error || 'Unable to load your orders.');
        }
        if (active) {
          setCustomer(accountPayload.customer);
          setName(accountPayload.customer.name);
          setEmail(accountPayload.customer.email ?? '');
          setProfileUsername(accountPayload.customer.username ?? '');
          setOrders(ordersPayload.orders);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load your account.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadAccount();
    return () => {
      active = false;
    };
  }, []);

  const requestCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/customer/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const payload = await response.json() as { phone?: string; message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to send a sign-in code.');
      setPhone(payload.phone ?? phone);
      setCodeSent(true);
      setNotice(payload.message ?? 'Check your phone for a sign-in code.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send a sign-in code.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/customer/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const payload = await response.json() as { customer?: CustomerAccount; error?: string };
      if (!response.ok || !payload.customer) throw new Error(payload.error || 'Unable to verify your sign-in code.');
      const next = new URLSearchParams(window.location.search).get('returnTo');
      if (next === '/checkout') {
        window.location.assign('/checkout');
        return;
      }
      setCustomer(payload.customer);
      setName(payload.customer.name);
      setEmail(payload.customer.email ?? '');
      const ordersResponse = await fetch('/api/customer/orders', { cache: 'no-store' });
      const ordersPayload = await ordersResponse.json() as { orders?: CustomerOrder[]; error?: string };
      if (!ordersResponse.ok || !ordersPayload.orders) {
        throw new Error(ordersPayload.error || 'Signed in, but unable to load your orders.');
      }
      setOrders(ordersPayload.orders);
      setCodeSent(false);
      setCode('');
      setNotice('You are signed in securely.');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Unable to verify your sign-in code.');
    } finally {
      setBusy(false);
    }
  };

  const submitPasswordAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/customer/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: passwordAction,
          username,
          password,
          ...(passwordAction === 'signup' ? { name: signupName, email: signupEmail } : {}),
        }),
      });
      const payload = await response.json() as { customer?: CustomerAccount; error?: string };
      if (!response.ok || !payload.customer) {
        throw new Error(payload.error || 'Unable to sign in.');
      }

      const next = new URLSearchParams(window.location.search).get('returnTo');
      if (next === '/checkout') {
        window.location.assign('/checkout');
        return;
      }
      setCustomer(payload.customer);
      setName(payload.customer.name);
      setEmail(payload.customer.email ?? '');
      const ordersResponse = await fetch('/api/customer/orders', { cache: 'no-store' });
      const ordersPayload = await ordersResponse.json() as { orders?: CustomerOrder[]; error?: string };
      if (!ordersResponse.ok || !ordersPayload.orders) {
        throw new Error(ordersPayload.error || 'Signed in, but unable to load your orders.');
      }
      setOrders(ordersPayload.orders);
      setPassword('');
      setNotice(passwordAction === 'signup' ? 'Your account has been created.' : 'You are signed in securely.');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  const requestPhoneLinkCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/customer/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneLinkValue }),
      });
      const payload = await response.json() as { phone?: string; message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to send a verification code.');
      setPhoneLinkValue(payload.phone ?? phoneLinkValue);
      setPhoneLinkCodeSent(true);
      setNotice(payload.message ?? 'Check your phone for a verification code.');
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'Unable to send a verification code.');
    } finally {
      setBusy(false);
    }
  };

  const verifyPhoneLinkCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/customer/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneLinkValue, code: phoneLinkCode }),
      });
      const payload = await response.json() as { customer?: CustomerAccount; error?: string };
      if (!response.ok || !payload.customer) throw new Error(payload.error || 'Unable to link your phone.');
      setCustomer(payload.customer);
      setPhoneLinkCodeSent(false);
      setPhoneLinkCode('');
      setPhoneLinkValue('');
      setNotice('Your phone number is verified and linked to this account.');
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'Unable to link your phone.');
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/customer/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          ...(!customer?.username && (profileUsername || profilePassword)
            ? { username: profileUsername, password: profilePassword }
            : {}),
        }),
      });
      const payload = await response.json() as { customer?: CustomerAccount; error?: string };
      if (!response.ok || !payload.customer) throw new Error(payload.error || 'Unable to save your profile.');
      setCustomer(payload.customer);
      setProfileUsername(payload.customer.username ?? '');
      setProfilePassword('');
      setNotice('Your profile has been saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save your profile.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/customer/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Unable to sign out. Please try again.');
      setCustomer(null);
      setOrders([]);
      setPhone('');
      setNotice('You have signed out.');
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Unable to sign out.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-shell py-10 sm:py-16">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.32em] text-[#b87580]">My account</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-[#382a2a] sm:text-5xl">
          {customer ? `Hello${customer.name ? `, ${customer.name}` : ''}` : 'Your orders, all in one place'}
        </h1>
      </div>

      {error ? <p role="alert" className="mb-5 rounded-2xl bg-[#f9e8e5] px-4 py-3 text-sm text-[#8e3f45]">{error}</p> : null}
      {notice ? <p role="status" className="mb-5 rounded-2xl bg-[#e8f4eb] px-4 py-3 text-sm text-[#356a49]">{notice}</p> : null}

      {loading ? (
        <div className="section-card p-8 text-sm text-[#8a6f6d]">Loading your account...</div>
      ) : customer ? (
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="section-card h-fit space-y-5 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f8f0ee] text-[#b87580]"><UserRound size={20} /></span>
              <div>
                <h2 className="font-serif text-2xl text-[#382a2a]">Your profile</h2>
                <p className="text-xs text-[#8a6f6d]">{customer.username ? `Username: ${customer.username}` : 'Phone sign-in account'}</p>
              </div>
            </div>
            <form onSubmit={saveProfile} className="space-y-4">
              <label className="block space-y-2 text-sm text-[#382a2a]">
                {customer.phone ? 'Verified phone' : 'Phone number (optional)'}
                <input value={customer.phone ?? 'Not linked'} readOnly className="w-full rounded-2xl border border-[#eadcdf] bg-[#f9f3f1] px-4 py-3 text-sm text-[#766563]" />
              </label>
              <label className="block space-y-2 text-sm text-[#382a2a]">
                Name <span className="text-xs text-[#8a6f6d]">(optional)</span>
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="name" className="w-full rounded-2xl border border-[#eadcdf] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" />
              </label>
              <label className="block space-y-2 text-sm text-[#382a2a]">
                Email <span className="text-xs text-[#8a6f6d]">(optional, for receipts and order updates)</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" className="w-full rounded-2xl border border-[#eadcdf] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" />
              </label>
              {!customer.username ? (
                <div className="space-y-3 rounded-2xl border border-[#f0dfda] p-4">
                  <div>
                    <h3 className="text-sm font-medium text-[#382a2a]">Add username and password sign-in</h3>
                    <p className="mt-1 text-xs leading-5 text-[#8a6f6d]">Use this account with a username and password as well as your verified phone.</p>
                  </div>
                  <label className="block space-y-2 text-sm text-[#382a2a]">
                    Username
                    <input value={profileUsername} onChange={(event) => setProfileUsername(event.target.value)} minLength={3} maxLength={32} autoComplete="username" pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" title="3-32 letters, numbers, dots, underscores, or hyphens" className="w-full rounded-2xl border border-[#eadcdf] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" />
                  </label>
                  <label className="block space-y-2 text-sm text-[#382a2a]">
                    New password
                    <input type="password" value={profilePassword} onChange={(event) => setProfilePassword(event.target.value)} minLength={12} maxLength={1024} autoComplete="new-password" className="w-full rounded-2xl border border-[#eadcdf] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" />
                    <span className="block text-xs text-[#8a6f6d]">Enter a username and password to enable password sign-in; use at least 12 characters.</span>
                  </label>
                </div>
              ) : null}
              <button type="submit" disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#382a2a] px-5 py-3 text-sm font-medium text-white hover:bg-[#b87580] disabled:opacity-60">
                <Save size={16} /> Save profile
              </button>
            </form>
            <div className="flex items-start gap-3 rounded-2xl bg-[#f8f0ee] p-4 text-xs leading-5 text-[#6e5b59]">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#b87580]" />
              {customer.username
                ? 'Your username and password sign in securely. A verified phone is optional.'
                : 'Sign-in codes are sent to your verified phone. Your email is optional.'}
            </div>
            {!customer.phone ? (
              <div className="rounded-2xl border border-[#f0dfda] p-4">
                <h3 className="text-sm font-medium text-[#382a2a]">Link a phone number (optional)</h3>
                <p className="mt-1 text-xs leading-5 text-[#8a6f6d]">Verify a phone to enable SMS-code sign-in as another way to access this account.</p>
                {!phoneLinkCodeSent ? (
                  <form onSubmit={requestPhoneLinkCode} className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input type="tel" inputMode="tel" autoComplete="tel" value={phoneLinkValue} onChange={(event) => setPhoneLinkValue(event.target.value)} placeholder="+254 712 345 678" className="min-h-11 min-w-0 flex-1 rounded-full border border-[#eadcdf] px-4 text-sm outline-none focus:border-[#b87580]" required />
                    <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-[#f8f0ee] px-4 text-sm text-[#382a2a] disabled:opacity-60">Send code</button>
                  </form>
                ) : (
                  <form onSubmit={verifyPhoneLinkCode} className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={phoneLinkCode} onChange={(event) => setPhoneLinkCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" className="min-h-11 min-w-0 flex-1 rounded-full border border-[#eadcdf] px-4 text-sm tracking-[0.2em] outline-none focus:border-[#b87580]" required />
                    <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-[#382a2a] px-4 text-sm text-white disabled:opacity-60">Verify phone</button>
                  </form>
                )}
              </div>
            ) : null}
            <button type="button" onClick={() => void signOut()} disabled={busy} className="inline-flex min-h-10 items-center gap-2 text-sm text-[#8a6f6d] hover:text-[#382a2a] disabled:opacity-60">
              <LogOut size={15} /> Sign out
            </button>
          </aside>

          <section className="section-card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <PackageCheck size={20} className="text-[#b87580]" />
              <div>
                <h2 className="font-serif text-3xl text-[#382a2a]">Your orders</h2>
                <p className="mt-1 text-sm text-[#8a6f6d]">Track order and payment status, items, totals, and delivery details.</p>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="mt-6 rounded-[20px] border border-[#f0dfda] bg-[#f9f3f1] p-6 text-center">
                <p className="text-sm text-[#8a6f6d]">You have not placed an order yet.</p>
                <Link href="/shop" className="primary-button mt-4">Explore the shop</Link>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {orders.map((order) => (
                  <article key={order.id} className="rounded-[20px] border border-[#f0dfda] p-4 sm:p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#b87580]">{order.orderNumber}</p>
                        <p className="mt-1 text-xs text-[#8a6f6d]">{new Date(order.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#f8f0ee] px-3 py-1 text-xs text-[#6e5b59]">{prettyStatus(order.status)}</span>
                        <span className="rounded-full bg-[#f8f0ee] px-3 py-1 text-xs text-[#6e5b59]">Payment: {prettyStatus(order.paymentStatus)}</span>
                      </div>
                    </div>
                    <ul className="mt-4 divide-y divide-[#f0dfda]">
                      {order.items.map((item) => (
                        <li key={`${order.id}-${item.id}`} className="flex justify-between gap-3 py-3 text-sm text-[#5d4c4b]">
                          <span>{item.productName} × {item.quantity}</span>
                          <span>${(item.unitPrice * item.quantity).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-[#f0dfda] pt-3 text-sm">
                      <span className="text-[#8a6f6d]">Delivery to {order.addressLine1}, {order.city}</span>
                      <span className="font-semibold text-[#382a2a]">Total ${order.total.toFixed(2)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="section-card mx-auto max-w-xl p-5 sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f8f0ee] text-[#b87580]"><ShieldCheck size={20} /></span>
            <div>
              <h2 className="font-serif text-3xl text-[#382a2a]">Create an account or sign in</h2>
              <p className="mt-2 text-sm leading-6 text-[#8a6f6d]">Choose a phone verification code or use a username and password. Email and phone are optional for username accounts.</p>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-full bg-[#f8f0ee] p-1">
            <button type="button" onClick={() => { setAuthMethod('phone'); setError(''); setNotice(''); }} className={`min-h-10 rounded-full px-3 text-sm ${authMethod === 'phone' ? 'bg-white text-[#382a2a] shadow-sm' : 'text-[#8a6f6d]'}`}>Phone code</button>
            <button type="button" onClick={() => { setAuthMethod('username'); setCodeSent(false); setError(''); setNotice(''); }} className={`min-h-10 rounded-full px-3 text-sm ${authMethod === 'username' ? 'bg-white text-[#382a2a] shadow-sm' : 'text-[#8a6f6d]'}`}>Username &amp; password</button>
          </div>

          {authMethod === 'phone' ? !codeSent ? (
            <form onSubmit={requestCode} className="space-y-4">
              <label className="block space-y-2 text-sm text-[#382a2a]">
                Phone number
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="0712 345 678 or +254 712 345 678"
                  className="w-full rounded-2xl border border-[#eadcdf] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]"
                  required
                />
              </label>
              <p className="text-xs leading-5 text-[#8a6f6d]">A standard SMS charge may apply. Enter your number with a country code if you are outside Kenya.</p>
              <button type="submit" disabled={busy} className="min-h-12 w-full rounded-full bg-[#382a2a] px-5 py-3 text-sm font-medium text-white hover:bg-[#b87580] disabled:opacity-60">
                {busy ? 'Sending code...' : 'Text me a sign-in code'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4">
              <p className="text-sm leading-6 text-[#5d4c4b]">Enter the six-digit code sent to <strong>{phone}</strong>. It expires in 10 minutes.</p>
              <label className="block space-y-2 text-sm text-[#382a2a]">
                Verification code
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-2xl border border-[#eadcdf] bg-white px-4 py-3 text-center text-xl tracking-[0.35em] outline-none focus:border-[#b87580]"
                  required
                />
              </label>
              <button type="submit" disabled={busy} className="min-h-12 w-full rounded-full bg-[#382a2a] px-5 py-3 text-sm font-medium text-white hover:bg-[#b87580] disabled:opacity-60">
                {busy ? 'Verifying...' : 'Verify and continue'}
              </button>
              <button type="button" disabled={busy} onClick={() => { setCodeSent(false); setCode(''); setNotice(''); setError(''); }} className="w-full py-2 text-sm text-[#9b626d] underline underline-offset-4 disabled:opacity-60">
                Use a different phone number
              </button>
            </form>
          ) : (
            <div>
              <div className="mb-4 flex gap-4 border-b border-[#f0dfda]">
                <button type="button" onClick={() => { setPasswordAction('login'); setError(''); }} className={`border-b-2 px-1 pb-2 text-sm ${passwordAction === 'login' ? 'border-[#b87580] text-[#382a2a]' : 'border-transparent text-[#8a6f6d]'}`}>Sign in</button>
                <button type="button" onClick={() => { setPasswordAction('signup'); setError(''); }} className={`border-b-2 px-1 pb-2 text-sm ${passwordAction === 'signup' ? 'border-[#b87580] text-[#382a2a]' : 'border-transparent text-[#8a6f6d]'}`}>Create account</button>
              </div>
              <form onSubmit={submitPasswordAccount} className="space-y-4">
                {passwordAction === 'signup' ? (
                  <>
                    <label className="block space-y-2 text-sm text-[#382a2a]">
                      Name <span className="text-xs text-[#8a6f6d]">(optional)</span>
                      <input value={signupName} onChange={(event) => setSignupName(event.target.value)} maxLength={120} autoComplete="name" className="w-full rounded-2xl border border-[#eadcdf] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" />
                    </label>
                    <label className="block space-y-2 text-sm text-[#382a2a]">
                      Email <span className="text-xs text-[#8a6f6d]">(optional, for receipts)</span>
                      <input type="email" value={signupEmail} onChange={(event) => setSignupEmail(event.target.value)} maxLength={254} autoComplete="email" className="w-full rounded-2xl border border-[#eadcdf] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" />
                    </label>
                  </>
                ) : null}
                <label className="block space-y-2 text-sm text-[#382a2a]">
                  Username
                  <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={32} autoComplete="username" pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" title="3-32 letters, numbers, dots, underscores, or hyphens" className="w-full rounded-2xl border border-[#eadcdf] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" required />
                </label>
                <label className="block space-y-2 text-sm text-[#382a2a]">
                  Password
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={1024} autoComplete={passwordAction === 'signup' ? 'new-password' : 'current-password'} className="w-full rounded-2xl border border-[#eadcdf] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" required />
                  {passwordAction === 'signup' ? <span className="block text-xs text-[#8a6f6d]">Use at least 12 characters.</span> : null}
                </label>
                <button type="submit" disabled={busy} className="min-h-12 w-full rounded-full bg-[#382a2a] px-5 py-3 text-sm font-medium text-white hover:bg-[#b87580] disabled:opacity-60">
                  {busy ? 'Please wait...' : passwordAction === 'signup' ? 'Create account' : 'Sign in'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
