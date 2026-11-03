import Link from 'next/link';
import { ArrowRight, CheckCircle2, Leaf, Recycle, ShieldCheck, Sparkles } from 'lucide-react';

import { HeroImageSlider } from '@/components/hero-image-slider';
import { ProductCard } from '@/components/product-card';
import { SectionHeading } from '@/components/section-heading';
import { benefits, testimonials } from '@/lib/data';
import { getCategories, getSiteContent, readCollections, readProducts } from '@/lib/store';
import { DEFAULT_HERO_SLIDE_IMAGES } from '@/lib/site-content';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const products = await readProducts();
  const [siteContent, categories, collections] = await Promise.all([
    getSiteContent(),
    getCategories(),
    readCollections(),
  ]);
  const heroImages = DEFAULT_HERO_SLIDE_IMAGES.map(
    (_, index) => siteContent[`hero_slide_${index + 1}`] || DEFAULT_HERO_SLIDE_IMAGES[index],
  );
  const productsForPlacement = (placement: string) =>
    products.filter((product) => product.placements?.includes(placement)).slice(0, 6);
  const featuredProducts = productsForPlacement('featured');
  const categoryProducts = productsForPlacement('shop_by_category');
  const seasonalProducts = productsForPlacement('seasonal_offer');
  const bestSellers = products
    .filter((product) => (product.unitsSold ?? 0) > 0)
    .sort((left, right) => (right.unitsSold ?? 0) - (left.unitsSold ?? 0))
    .slice(0, 6);
  const customerFavorites = products
    .filter((product) => (product.viewCount ?? 0) > 0)
    .sort((left, right) => {
      const leftScore = (left.viewCount ?? 0) + (left.engagementSeconds ?? 0) / 30;
      const rightScore = (right.viewCount ?? 0) + (right.engagementSeconds ?? 0) / 30;
      return rightScore - leftScore;
    })
    .slice(0, 6);
  const newArrivals = productsForPlacement('new_arrivals');
  const festiveProducts = productsForPlacement('festive_season');
  const customPlacements = [...new Set(
    products.flatMap((product) => product.placements ?? [])
      .filter((placement) => typeof placement === 'string' && placement.startsWith('custom:')),
  )];
  const customPlacementTitle = (placement: string) =>
    placement.slice('custom:'.length).split('-').map((word) => (
      word ? `${word[0]?.toUpperCase()}${word.slice(1)}` : ''
    )).join(' ');
  return (
    <div>
      <section className="bg-[#f9f1ee]">
        <div className="container-shell grid items-center gap-8 py-8 sm:gap-10 sm:py-12 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div>
            <p className="mb-5 text-[10px] uppercase tracking-[0.34em] text-[#b87580]">{siteContent.hero_badge}</p>
            <h1 className="max-w-xl font-serif text-4xl leading-[1.04] text-[#382a2a] sm:text-5xl lg:text-6xl">
              {siteContent.hero_title}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#5d4c4b] sm:mt-6 sm:text-lg sm:leading-8">
              {siteContent.hero_subtitle}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2 sm:mt-8 sm:gap-4">
              <Link href="/shop" className="primary-button">
                Shop Now <ArrowRight className="ml-2" size={16} />
              </Link>
              <Link href="/collections" className="soft-button">
                Explore Collections
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-[#5d4c4b] sm:mt-10 sm:gap-8 sm:text-sm">
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#b87580]" /> Cruelty free</div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#b87580]" /> Free shipping</div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#b87580]" /> 4.9 average rating</div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-10 top-10 h-32 w-32 rounded-full bg-[#f0d9d7] blur-2xl" />
            <div className="absolute right-0 bottom-10 h-40 w-40 rounded-full bg-[#e8d8c5] blur-3xl sm:-right-6" />
            <HeroImageSlider images={heroImages} />
          </div>
        </div>
      </section>

      <section className="container-shell py-10 sm:py-16">
        <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
          {benefits.map((benefit) => {
            const icons = {
              leaf: Leaf,
              sparkles: Sparkles,
              shield: ShieldCheck,
              recycle: Recycle,
            };
            const Icon = icons[benefit.icon as keyof typeof icons];

            return (
              <div key={benefit.name} className="section-card flex min-w-0 items-center gap-2 p-3 sm:gap-4 sm:p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f5e5e3] text-[#b87580]">
                  <Icon size={20} />
                </div>
                <p className="min-w-0 break-words text-xs font-medium leading-4 text-[#382a2a] sm:text-base sm:leading-5">{benefit.name}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="container-shell py-4">
        <SectionHeading eyebrow="Shop by Category" title="Find your perfect ritual" description="Curated favorites for every skin mood, texture and beauty moment." />
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-6">
          {categories.map((category) => (
            <Link key={category.id} href={`/shop?category=${encodeURIComponent(category.name)}`} className="group overflow-hidden rounded-[28px] border border-[#efd9d3] bg-white p-2 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="overflow-hidden rounded-[20px]">
                <img src={category.image} alt={category.name} className="h-40 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-56" />
              </div>
              <div className="px-2 pb-2 pt-4 text-center">
                <p className="font-serif text-lg text-[#382a2a] sm:text-2xl">{category.name}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {featuredProducts.length > 0 ? (
        <section className="container-shell py-10 sm:py-16">
          <SectionHeading eyebrow="Featured" title="In the spotlight" description="Handpicked essentials from the Zodiac Beauty collection." />
          <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      ) : null}

      {categoryProducts.length > 0 ? (
        <section className="container-shell py-8">
          <SectionHeading eyebrow="Shop by Category" title="Explore beauty essentials" />
          <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
            {categoryProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      ) : null}

      <section className="container-shell py-10 sm:py-16">
        <div className="section-card overflow-hidden bg-[#f7edea] p-4 sm:p-6 md:p-10">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.34em] text-[#b87580]">Seasonal Offer</p>
              <h2 className="mt-4 font-serif text-3xl text-[#382a2a] sm:text-4xl md:text-5xl">{siteContent.sale_title}</h2>
              <p className="mt-4 max-w-md text-base leading-7 text-[#5d4c4b] sm:text-lg sm:leading-8">
                {siteContent.sale_description}
              </p>
              <div className="mt-6">
                <Link href="/shop" className="secondary-button">
                  Shop Sale <ArrowRight className="ml-2" size={16} />
                </Link>
              </div>
            </div>
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1100&q=80"
                alt="Beauty products"
                className="h-[300px] w-full rounded-[24px] object-cover sm:h-[420px] sm:rounded-[28px]"
              />
            </div>
          </div>
        </div>
      </section>

      {seasonalProducts.length > 0 ? (
        <section className="container-shell pb-10 sm:pb-16">
          <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
            {seasonalProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      ) : null}

      {bestSellers.length > 0 ? <section className="container-shell py-4">
        <SectionHeading eyebrow="Best Sellers" title="Top sellers" description="Automatically ranked by the number of units sold." />
        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
          {bestSellers.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section> : null}

      {customerFavorites.length > 0 ? <section className="container-shell py-8 sm:py-12">
        <SectionHeading eyebrow="Customer Favorites" title="Most explored" description="Ranked by visits, with one extra point for every 30 seconds spent viewing." />
        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
          {customerFavorites.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section> : null}

      {newArrivals.length > 0 ? <section className="container-shell py-10 sm:py-16">
        <SectionHeading eyebrow="New Arrivals" title="Fresh drops for your next glow" />
        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
          {newArrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section> : null}

      {festiveProducts.length > 0 ? (
        <section className="container-shell py-8">
          <SectionHeading eyebrow="Limited Edition" title="Festive season" description="Celebrate the season with a little extra glow." />
          <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
            {festiveProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      ) : null}

      {customPlacements.map((placement) => {
        const placedProducts = productsForPlacement(placement);
        const title = customPlacementTitle(placement);
        return placedProducts.length > 0 ? (
          <section key={placement} className="container-shell py-12">
            <SectionHeading eyebrow="Seasonal edit" title={title} />
            <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
              {placedProducts.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </section>
        ) : null;
      })}

      {collections.length > 0 ? <section className="container-shell py-4">
        <SectionHeading eyebrow="Featured Collections" title="Curated for everyday luxury" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.slice(0, 3).map((collection) => (
            <Link key={collection.id} href={`/shop?collection=${encodeURIComponent(collection.name)}`} className="group relative overflow-hidden rounded-[32px]">
              <img src={collection.image} alt={collection.name} className="h-[320px] w-full object-cover transition duration-500 group-hover:scale-105 sm:h-[420px]" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2a1f1f]/70 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-7 text-white">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#f6dce0]">{collection.description}</p>
                <h3 className="mt-3 font-serif text-3xl sm:text-4xl">{collection.name}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section> : null}

      <section className="container-shell py-10 sm:py-16">
        <SectionHeading eyebrow="Loved by our community" title="What customers say" />
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div key={testimonial.name} className="section-card p-5 sm:p-7">
              <div className="mb-4 flex gap-1 text-[#b87580]">
                {[...Array(testimonial.rating)].map((_, index) => (
                  <span key={index}>★</span>
                ))}
              </div>
              <p className="text-base leading-7 text-[#382a2a] sm:text-lg sm:leading-8">“{testimonial.quote}”</p>
              <div className="mt-6 border-t border-[#f0dfda] pt-4">
                <p className="font-semibold text-[#382a2a]">{testimonial.name}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6f6d]">{testimonial.title}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-shell py-8">
        <div className="section-card overflow-hidden bg-[#f5e5e2] px-4 py-8 sm:px-6 sm:py-10 md:px-10">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#b87580]">Stay in the glow</p>
              <h3 className="mt-3 font-serif text-3xl text-[#382a2a] sm:text-4xl">Join our beauty newsletter</h3>
              <p className="mt-2 max-w-lg text-base text-[#5d4c4b]">Beauty tips, new arrivals, and glow-worthy offers sent to your inbox.</p>
            </div>
            <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-[#e0c7c2] bg-white px-2 py-2 sm:gap-3 sm:px-3">
              <input type="email" placeholder="Email address" className="w-full border-0 bg-transparent px-2 py-2 text-sm text-[#382a2a] outline-none placeholder:text-[#a28c8b]" />
              <button className="primary-button">Join</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
