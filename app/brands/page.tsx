import Image from 'next/image';
import Link from 'next/link';

import { readBrands } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function BrandsPage() {
  const brands = await readBrands();
  return (
    <div className="container-shell py-10 sm:py-16">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.34em] text-[#b87580]">Our brands</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-[#382a2a] sm:text-5xl">Beauty brands to know</h1>
      </div>
      {brands.length === 0 ? (
        <p className="section-card p-8 text-sm text-[#8a6f6d]">Brand selections are coming soon.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
          {brands.map((brand) => (
            <Link key={brand.id} href={`/shop?brand=${encodeURIComponent(brand.name)}`} className="section-card group overflow-hidden">
              <Image src={brand.image} alt={brand.name} width={900} height={700} unoptimized className="h-64 w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="p-3 sm:p-5">
                <h2 className="font-serif text-xl text-[#382a2a] sm:text-3xl">{brand.name}</h2>
                {brand.description ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#665351] sm:text-sm sm:leading-6">{brand.description}</p> : null}
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#9b626d]">{brand.productCount} products</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
