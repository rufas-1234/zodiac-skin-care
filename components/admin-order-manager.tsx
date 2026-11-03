"use client";

import { useCallback, useEffect, useState } from 'react';

import type { CustomerOrder } from '@/lib/customer-types';

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;

function prettyStatus(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AdminOrderManager() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOrders = useCallback(async () => {
    const response = await fetch('/api/admin/orders', { cache: 'no-store' });
    const payload = await response.json() as { orders?: CustomerOrder[]; error?: string };
    if (!response.ok || !payload.orders) {
      throw new Error(payload.error || 'Unable to load orders.');
    }
    setOrders(payload.orders);
  }, []);

  useEffect(() => {
    void loadOrders()
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load orders.'))
      .finally(() => setLoading(false));
  }, [loadOrders]);

  const updateOrder = async (
    order: CustomerOrder,
    status: string,
    paymentStatus: string,
  ) => {
    setSavingId(order.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, paymentStatus }),
      });
      const payload = await response.json() as { order?: CustomerOrder; error?: string };
      if (!response.ok || !payload.order) {
        throw new Error(payload.error || 'Unable to update this order.');
      }
      setOrders((current) => current.map((item) => item.id === order.id ? payload.order! : item));
      setNotice(`Order ${order.orderNumber} updated.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update this order.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <p className="section-card p-6 text-sm text-[#8a6f6d]">Loading customer orders...</p>;
  }

  return (
    <section className="space-y-4">
      {error ? <p role="alert" className="rounded-2xl bg-[#f9e8e5] px-4 py-3 text-sm text-[#8e3f45]">{error}</p> : null}
      {notice ? <p role="status" className="rounded-2xl bg-[#e8f4eb] px-4 py-3 text-sm text-[#356a49]">{notice}</p> : null}
      {orders.length === 0 ? (
        <div className="section-card p-8 text-center text-sm text-[#8a6f6d]">
          No customer orders have been placed yet.
        </div>
      ) : orders.map((order) => (
        <article key={order.id} className="section-card space-y-5 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#b87580]">{order.orderNumber}</p>
              <h2 className="mt-1 font-serif text-2xl text-[#382a2a]">{order.contactName}</h2>
              <p className="mt-1 text-sm text-[#8a6f6d]">
                {order.phone}{order.email ? ` · ${order.email}` : ''} · {new Date(order.createdAt).toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-[#5d4c4b]">
                {[order.addressLine1, order.addressLine2, order.city, order.postalCode].filter(Boolean).join(', ')}
              </p>
            </div>
            <p className="text-lg font-semibold text-[#382a2a]">${order.total.toFixed(2)}</p>
          </div>

          <ul className="divide-y divide-[#f0dfda] rounded-2xl border border-[#f0dfda] px-4">
            {order.items.map((item) => (
              <li key={`${order.id}-${item.id}`} className="flex justify-between gap-3 py-3 text-sm text-[#5d4c4b]">
                <span>{item.productName} × {item.quantity}</span>
                <span>${(item.unitPrice * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs text-[#8a6f6d]">
              Order status
              <select
                value={order.status}
                disabled={savingId === order.id}
                onChange={(event) => void updateOrder(order, event.target.value, order.paymentStatus)}
                className="min-h-10 rounded-full border border-[#e9d8d0] bg-white px-3 text-sm text-[#382a2a]"
                aria-label={`Order status for ${order.orderNumber}`}
              >
                {ORDER_STATUSES.map((status) => <option key={status} value={status}>{prettyStatus(status)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-[#8a6f6d]">
              Payment
              <select
                value={order.paymentStatus}
                disabled={savingId === order.id}
                onChange={(event) => void updateOrder(order, order.status, event.target.value)}
                className="min-h-10 rounded-full border border-[#e9d8d0] bg-white px-3 text-sm text-[#382a2a]"
                aria-label={`Payment status for ${order.orderNumber}`}
              >
                {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{prettyStatus(status)}</option>)}
              </select>
            </label>
            {savingId === order.id ? <span className="pb-2 text-xs text-[#8a6f6d]">Saving...</span> : null}
            <p className="pb-2 text-xs text-[#8a6f6d]">
              {prettyStatus(order.paymentMethod)} · Subtotal ${order.subtotal.toFixed(2)} · Shipping ${order.shipping.toFixed(2)}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
