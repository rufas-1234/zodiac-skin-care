import Image from 'next/image';
import Link from 'next/link';

import { readCollections } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function CollectionsPage() {
  const collections = await readCollections();
  return (
    <div className="container-shell py-10 sm:py-16">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.34em] text-[#b87580]">Collections</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-[#382a2a] sm:text-5xl">Curated rituals and seasonal favorites</h1>
      </div>
      {collections.length === 0 ? (
        <p className="section-card p-8 text-sm text-[#8a6f6d]">Collections are coming soon.</p>
      ) : (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/shop?collection=${encodeURIComponent(collection.name)}`}
              className="group relative overflow-hidden rounded-[24px] border border-[#f0dfda] bg-white p-2.5 shadow-sm sm:rounded-[32px] sm:p-3"
            >
              <Image src={collection.image} alt={collection.name} width={900} height={900} unoptimized className="h-[min(90vw,360px)] w-full rounded-[18px] object-cover transition duration-500 group-hover:scale-105 sm:h-[420px] sm:rounded-[24px]" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2a1f1f]/80 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#f4d8d3]">{collection.productCount} products</p>
                <h2 className="mt-3 font-serif text-3xl sm:text-4xl">{collection.name}</h2>
                {collection.description ? <p className="mt-2 line-clamp-2 text-sm text-white/85">{collection.description}</p> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
