"use client";

import Link from 'next/link';
import { Heart, ShoppingBag, Star } from 'lucide-react';

import { useCart } from '@/components/cart-provider';
import { ProductOrderLinks } from '@/components/product-order-links';
import type { Product } from '@/lib/data';

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();

  return (
    <article className="group min-w-0 overflow-hidden rounded-[22px] border border-[#f0dfda] bg-white p-2 shadow-[0_5px_18px_rgba(56,42,42,0.04)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(56,42,42,0.08)] sm:rounded-[30px] sm:p-3">
      <div className="relative overflow-hidden rounded-[22px] bg-[#f7f2f0]">
        <div className="absolute left-3 top-3 z-10 rounded-full bg-[#f7ddd8] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#382a2a]">
          {product.badge}
        </div>
        <button
          type="button"
          aria-label={`Save ${product.name}`}
          className="absolute right-3 top-3 z-10 rounded-full border border-[#f0dfda] bg-white/80 p-2 text-[#382a2a] shadow-sm backdrop-blur-sm transition hover:text-[#b87580]"
        >
          <Heart size={15} />
        </button>
        <Link href={`/products/${product.slug}`} className="block">
          <img src={product.image} alt={product.name} className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" />
        </Link>
      </div>

      <div className="px-1 pb-1 pt-3 sm:px-2 sm:pb-2 sm:pt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 sm:mb-3">
          <span className="text-[9px] uppercase tracking-[0.12em] text-[#b87580] sm:text-[10px] sm:tracking-[0.2em]">{product.category}</span>
          <div className="flex items-center gap-1 text-[#382a2a]">
            <Star size={14} fill="#b87580" className="text-[#b87580]" />
            <span className="text-[11px] sm:text-xs">{product.rating}</span>
            <span className="text-[10px] text-[#7d625f] sm:text-[11px]">({product.reviews})</span>
          </div>
        </div>

        <Link href={`/products/${product.slug}`}>
          <h3 className="line-clamp-2 font-serif text-lg leading-tight text-[#382a2a] sm:text-2xl">{product.name}</h3>
        </Link>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#5d4c4b] sm:text-sm sm:leading-6">{product.shortDescription}</p>

        <div className="mt-3 flex flex-col items-stretch gap-2 sm:mt-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-[#382a2a] sm:text-xl">${product.price}</span>
              {product.originalPrice ? (
                <span className="text-xs text-[#8a7c7b] line-through sm:text-sm">${product.originalPrice}</span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => addToCart(product, 1)}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#382a2a] px-2 py-2 text-xs font-medium text-white transition hover:bg-[#b87580] sm:gap-2 sm:px-4 sm:text-sm"
          >
            <ShoppingBag size={14} /> Add to Cart
          </button>
        </div>
        <ProductOrderLinks product={product} compact />
      </div>
    </article>
  );
}
