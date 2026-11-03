"use client";

import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';

import { useCart } from '@/components/cart-provider';

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeFromCart } = useCart();

  const shipping = subtotal === 0 ? 0 : subtotal > 120 ? 0 : 18;
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <div className="container-shell py-12 sm:py-20">
        <div className="section-card mx-auto max-w-xl p-6 text-center sm:p-10">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#b87580]">Your cart</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-[#382a2a] sm:text-5xl">Your bag is empty.</h1>
          <p className="mt-4 text-base text-[#5d4c4b]">Add a few glow-boosting essentials to begin your ritual.</p>
          <Link href="/shop" className="primary-button mt-8">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-shell py-10 sm:py-16">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.32em] text-[#b87580]">Shopping bag</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-[#382a2a] sm:text-5xl">Your cart</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="section-card flex flex-col gap-4 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <img src={product.image} alt={product.name} className="h-24 w-20 shrink-0 rounded-[16px] object-cover sm:h-28 sm:w-24 sm:rounded-[20px]" />
              <div className="min-w-0">
                <p className="break-words font-serif text-xl text-[#382a2a] sm:text-2xl">{product.name}</p>
                  <p className="mt-1 text-sm text-[#5d4c4b]">{product.category}</p>
                  <p className="mt-2 text-base font-medium text-[#382a2a]">${product.price}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="flex items-center rounded-full border border-[#edd8d4] bg-[#f9f2f1] p-1">
                  <button type="button" aria-label={`Decrease ${product.name} quantity`} className="flex h-10 w-10 items-center justify-center rounded-full text-[#382a2a]" onClick={() => updateQuantity(product.id, quantity - 1)}>
                    <Minus size={14} />
                  </button>
                  <span className="w-7 text-center text-sm font-medium text-[#382a2a]">{quantity}</span>
                  <button type="button" aria-label={`Increase ${product.name} quantity`} className="flex h-10 w-10 items-center justify-center rounded-full text-[#382a2a]" onClick={() => updateQuantity(product.id, quantity + 1)}>
                    <Plus size={14} />
                  </button>
                </div>
                <button type="button" aria-label={`Remove ${product.name} from cart`} className="flex h-10 w-10 items-center justify-center rounded-full text-[#b87580]" onClick={() => removeFromCart(product.id)}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <aside className="section-card h-fit p-5 sm:p-6">
          <h2 className="font-serif text-3xl text-[#382a2a]">Order summary</h2>
          <div className="mt-6 space-y-4 text-sm text-[#5d4c4b]">
            <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>-$0.00</span></div>
          </div>
          <div className="mt-6 border-t border-[#f0dfda] pt-5">
            <div className="flex items-center justify-between text-lg font-semibold text-[#382a2a]">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
          <Link href="/checkout" className="primary-button mt-6 w-full">
            Proceed to Checkout
          </Link>
          <Link href="/shop" className="soft-button mt-3 w-full">
            Continue Shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
