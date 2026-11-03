import Link from 'next/link';
import { ArrowLeft, Check, Star } from 'lucide-react';
import { notFound } from 'next/navigation';

import { ProductDetailActions } from '@/components/product-detail-actions';
import { ProductCard } from '@/components/product-card';
import { ProductEngagementTracker } from '@/components/product-engagement-tracker';
import { readProducts } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products = await readProducts();
  const product = products.find((item) => item.slug === slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = products.filter((item) => item.category === product.category && item.slug !== product.slug).slice(0, 3);

  return (
    <div className="container-shell py-10 sm:py-16">
      <ProductEngagementTracker productId={product.id} />
      <Link href="/shop" className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm text-[#5d4c4b] transition hover:text-[#b87580] sm:mb-8">
        <ArrowLeft size={15} /> Back to shop
      </Link>

      <div className="grid min-w-0 gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-[24px] border border-[#f0dfda] bg-white p-2 shadow-sm sm:rounded-[30px] sm:p-3">
            <img src={product.image} alt={product.name} className="h-[min(100vw,390px)] w-full rounded-[18px] object-cover sm:h-[520px] sm:rounded-[20px]" />
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.32em] text-[#b87580]">{product.category}</p>
          <h1 className="mt-3 break-words font-serif text-4xl leading-tight text-[#382a2a] sm:text-5xl">{product.name}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 text-[#b87580]">
              {[...Array(5)].map((_, index) => (
                <Star key={index} size={15} fill="#b87580" className="text-[#b87580]" />
              ))}
            </div>
            <span className="text-sm text-[#5d4c4b]">{product.rating} ({product.reviews} reviews)</span>
          </div>

          <div className="mt-5 flex items-end gap-3">
            <span className="text-3xl font-semibold text-[#382a2a]">${product.price}</span>
            {product.originalPrice ? (
              <span className="text-lg text-[#8a7c7b] line-through">${product.originalPrice}</span>
            ) : null}
          </div>

          <p className="mt-5 text-base leading-7 text-[#5d4c4b] sm:mt-6 sm:leading-8">{product.description}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3 text-sm text-[#382a2a]">
            {product.sizes.map((size) => (
              <span key={size} className="rounded-full border border-[#e9d8d0] bg-[#fff] px-3 py-1.5">{size}</span>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3 text-sm text-[#382a2a]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#6ba075]" />
            {product.stock > 0 ? `${product.stock} items in stock` : 'Sold out'}
          </div>

          <ProductDetailActions product={product} />

          <div className="mt-8 rounded-[24px] border border-[#f0dfda] bg-[#f9f3f1] p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.26em] text-[#b87580]">Why you’ll love it</p>
            <ul className="space-y-3 text-sm text-[#5d4c4b]">
              {product.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 text-[#b87580]" /> {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-4 sm:mt-20 sm:gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[24px] border border-[#f0dfda] bg-white p-5 sm:rounded-[28px] sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#b87580]">Ingredients</p>
          <ul className="mt-4 space-y-3 text-sm text-[#5d4c4b]">
            {product.ingredients.map((ingredient) => (
              <li key={ingredient}>• {ingredient}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-[24px] border border-[#f0dfda] bg-white p-5 sm:rounded-[28px] sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#b87580]">How to use</p>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-7 text-[#5d4c4b]">
            <li>Apply 2–3 drops to clean, dry skin and press gently into the face and neck.</li>
            <li>Follow with moisturizer or sunscreen for best results in your routine.</li>
            <li>Use morning and evening for soft, hydrated skin and a healthy glow.</li>
          </ol>
        </div>
      </div>

      <div className="mt-12 sm:mt-20">
        <div className="mb-6 flex items-end justify-between sm:mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#b87580]">Related products</p>
            <h2 className="mt-2 font-serif text-3xl text-[#382a2a] sm:text-4xl">You might also love</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
          {relatedProducts.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
