"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Lock, Truck } from 'lucide-react';

import { useCart } from '@/components/cart-provider';
import type { CustomerAccount, CustomerOrder } from '@/lib/customer-types';

type PaymentMethod = 'cash_on_delivery' | 'mpesa';

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void fetch('/api/customer/account', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) return;
        const payload = await response.json() as { customer?: CustomerAccount; error?: string };
        if (!response.ok || !payload.customer) {
          throw new Error(payload.error || 'Unable to load your customer account.');
        }
        if (active) {
          setCustomer(payload.customer);
          setContactName(payload.customer.name);
          setContactPhone(payload.customer.phone ?? '');
          setEmail(payload.customer.email ?? '');
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load your customer account.');
      })
      .finally(() => {
        if (active) setLoadingAccount(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const shipping = subtotal === 0 || subtotal > 120 ? 0 : 18;
  const total = subtotal + shipping;
  const itemCount = useMemo(() => items.reduce((count, item) => count + item.quantity, 0), [items]);

  const placeOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName,
          phone: contactPhone,
          email,
          addressLine1,
          addressLine2,
          city,
          postalCode,
          paymentMethod,
          items: items.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        }),
      });
      const payload = await response.json() as { order?: CustomerOrder; error?: string };
      if (!response.ok || !payload.order) throw new Error(payload.error || 'Unable to place your order.');
      setOrder(payload.order);
      clearCart();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to place your order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (order) {
    return (
      <div className="container-shell py-12 sm:py-20">
        <div className="section-card mx-auto max-w-xl p-6 text-center sm:p-10">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#b87580]">Order received</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-[#382a2a] sm:text-5xl">Thank you for your order.</h1>
          <p className="mt-4 text-sm leading-6 text-[#8a6f6d]">
            Order <strong>{order.orderNumber}</strong> is pending. You can check its status, items, and delivery details in your account.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/account" className="primary-button">View my orders</Link>
            <Link href="/shop" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#e9d8d0] px-5 py-3 text-sm text-[#382a2a] hover:border-[#b87580]">Continue shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-shell py-12 sm:py-20">
        <div className="section-card mx-auto max-w-xl p-6 text-center sm:p-10">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#b87580]">Checkout</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-[#382a2a] sm:text-5xl">Your cart is empty.</h1>
          <Link href="/shop" className="primary-button mt-8">Shop products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-shell py-10 sm:py-16">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.32em] text-[#b87580]">Checkout</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-[#382a2a] sm:text-5xl">Secure checkout</h1>
      </div>

      {error ? <p role="alert" className="mb-5 rounded-2xl bg-[#f9e8e5] px-4 py-3 text-sm text-[#8e3f45]">{error}</p> : null}
      {loadingAccount ? (
        <div className="section-card p-6 text-sm text-[#8a6f6d]">Checking your account...</div>
      ) : !customer ? (
        <div className="section-card mb-6 flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <h2 className="font-serif text-2xl text-[#382a2a]">Sign in to place your order</h2>
            <p className="mt-1 text-sm text-[#8a6f6d]">Use your phone number and a one-time SMS code. Your order will be saved to your account.</p>
          </div>
          <Link href="/account?returnTo=%2Fcheckout" className="primary-button shrink-0">Sign in or create account</Link>
        </div>
      ) : null}

      <form onSubmit={placeOrder} className="grid items-start gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="section-card space-y-7 p-4 sm:p-6">
          <section>
            <h2 className="font-serif text-3xl text-[#382a2a]">Contact</h2>
            <p className="mt-1 text-sm text-[#8a6f6d]">Signed in as {customer?.phone ?? '—'}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-[#382a2a]">
                Name
                <input value={contactName} onChange={(event) => setContactName(event.target.value)} maxLength={120} autoComplete="name" className="w-full rounded-2xl border border-[#e9d8d0] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" required />
              </label>
              <label className="space-y-2 text-sm text-[#382a2a]">
                Delivery phone
                <input type="tel" inputMode="tel" autoComplete="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+254 712 345 678" className="w-full rounded-2xl border border-[#e9d8d0] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" required />
              </label>
              <label className="space-y-2 text-sm text-[#382a2a]">
                Email <span className="text-xs text-[#8a6f6d]">(optional)</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" className="w-full rounded-2xl border border-[#e9d8d0] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" />
              </label>
            </div>
          </section>

          <section>
            <h2 className="font-serif text-3xl text-[#382a2a]">Delivery</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-[#382a2a] md:col-span-2">
                Address line 1
                <input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} maxLength={255} autoComplete="address-line1" className="w-full rounded-2xl border border-[#e9d8d0] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" required />
              </label>
              <label className="space-y-2 text-sm text-[#382a2a] md:col-span-2">
                Address line 2 <span className="text-xs text-[#8a6f6d]">(optional)</span>
                <input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} maxLength={255} autoComplete="address-line2" className="w-full rounded-2xl border border-[#e9d8d0] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" />
              </label>
              <label className="space-y-2 text-sm text-[#382a2a]">
                City
                <input value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} autoComplete="address-level2" className="w-full rounded-2xl border border-[#e9d8d0] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" required />
              </label>
              <label className="space-y-2 text-sm text-[#382a2a]">
                Postal code <span className="text-xs text-[#8a6f6d]">(optional)</span>
                <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} maxLength={32} autoComplete="postal-code" className="w-full rounded-2xl border border-[#e9d8d0] bg-white px-4 py-3 text-sm outline-none focus:border-[#b87580]" />
              </label>
            </div>
          </section>

          <section>
            <h2 className="font-serif text-3xl text-[#382a2a]">Payment</h2>
            <div className="mt-4 space-y-3 rounded-[24px] border border-[#e9d8d0] bg-white p-4">
              <label className="flex items-start gap-3 text-sm text-[#382a2a]">
                <input type="radio" name="payment" value="cash_on_delivery" checked={paymentMethod === 'cash_on_delivery'} onChange={() => setPaymentMethod('cash_on_delivery')} className="mt-1 accent-[#b87580]" />
                <span>Cash on delivery<span className="mt-1 block text-xs text-[#8a6f6d]">Pay when your order arrives.</span></span>
              </label>
              <label className="flex items-start gap-3 text-sm text-[#382a2a]">
                <input type="radio" name="payment" value="mpesa" checked={paymentMethod === 'mpesa'} onChange={() => setPaymentMethod('mpesa')} className="mt-1 accent-[#b87580]" />
                <span>M-Pesa<span className="mt-1 block text-xs text-[#8a6f6d]">Payment is not collected on this page. The store will share payment instructions and confirm your payment.</span></span>
              </label>
            </div>
          </section>
        </div>

        <aside className="section-card h-fit p-5 sm:p-6">
          <h2 className="font-serif text-3xl text-[#382a2a]">Order summary</h2>
          <div className="mt-5 space-y-3">
            {items.map(({ product, quantity }) => (
              <div key={product.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-[#f0dfda] bg-[#faf5f4] p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={product.image} alt="" className="h-14 w-12 shrink-0 rounded-[14px] object-cover" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#382a2a]">{product.name}</p>
                    <p className="text-xs text-[#8a6f6d]">Qty {quantity}</p>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-medium text-[#382a2a]">${(product.price * quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3 border-t border-[#f0dfda] pt-5 text-sm text-[#5d4c4b]">
            <div className="flex justify-between"><span>Items ({itemCount})</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span></div>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-[#f0dfda] pt-5 text-lg font-semibold text-[#382a2a]">
            <span>Total</span><span>${total.toFixed(2)}</span>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-[#e7d4d0] bg-[#f7efee] px-3 py-3 text-[9px] uppercase tracking-[0.12em] text-[#5d4c4b] sm:rounded-full sm:px-4 sm:text-xs sm:tracking-[0.16em]">
            <span className="flex items-center gap-2"><Lock size={12} /> Secure order</span>
            <span className="flex items-center gap-2"><Truck size={12} /> Delivery details saved</span>
          </div>

          <button type="submit" disabled={!customer || loadingAccount || submitting} className="primary-button mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? 'Placing order...' : 'Place order'}
          </button>
          <p className="mt-3 text-center text-xs text-[#8a6f6d]">You can track your order in your account. Stock is reserved when your order is placed.</p>
        </aside>
      </form>
    </div>
  );
}
