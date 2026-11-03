"use client";

import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Star } from 'lucide-react';
import { useState } from 'react';

import { useCart } from '@/components/cart-provider';
import { ProductOrderLinks } from '@/components/product-order-links';
import type { Product } from '@/lib/data';

export function ProductDetailActions({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="mt-8 space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-full border border-[#edd8d4] bg-[#f9f2f1] p-1">
          <button
            type="button"
            className="rounded-full p-2 text-[#382a2a] transition hover:bg-white"
            onClick={() => setQuantity((value) => Math.max(value - 1, 1))}
            aria-label="Decrease quantity"
          >
            <Minus size={16} />
          </button>
          <span className="w-8 text-center text-sm font-medium text-[#382a2a]">{quantity}</span>
          <button
            type="button"
            className="rounded-full p-2 text-[#382a2a] transition hover:bg-white"
            onClick={() => setQuantity((value) => value + 1)}
            aria-label="Increase quantity"
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => addToCart(product, quantity)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#382a2a] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#b87580]"
        >
          <ShoppingBag size={16} /> Add to Cart
        </button>
      </div>

      <div className="grid grid-cols-2 items-center gap-3 sm:flex sm:flex-wrap sm:gap-4">
        <Link href="/checkout" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#f3e1dc] px-4 py-3 text-sm font-medium text-[#382a2a] transition hover:bg-[#e8c9c5] sm:px-5">
          Buy Now
        </Link>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#5d4c4b] sm:gap-2 sm:text-sm">
          <Star size={14} fill="#b87580" className="text-[#b87580]" />
          <span>{product.rating} rating</span>
          <span className="text-[#8a6f6d]">({product.reviews} reviews)</span>
        </div>
        <div className="col-span-2 w-full sm:col-span-1 sm:w-auto"><ProductOrderLinks product={product} quantity={quantity} /></div>
      </div>
    </div>
  );
}
