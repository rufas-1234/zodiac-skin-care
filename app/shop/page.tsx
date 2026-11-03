"use client";

import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { ProductCard } from '@/components/product-card';
import { ProductSearchInput } from '@/components/product-search-input';
import type { Product } from '@/lib/data';
import type { StoreBrand, StoreCategory, StoreCollection } from '@/lib/store';

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="container-shell py-16 text-center text-sm text-[#8a6f6d]">Loading shop...</div>}>
      <ShopCatalog />
    </Suspense>
  );
}

function ShopCatalog() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [brands, setBrands] = useState<StoreBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCollection, setSelectedCollection] = useState('All');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [sortBy, setSortBy] = useState('featured');
  const [query, setQuery] = useState('');
  const [minimumPrice, setMinimumPrice] = useState('');
  const [maximumPrice, setMaximumPrice] = useState('');

  useEffect(() => {
    const category = searchParams.get('category');
    setSelectedCategory(category || 'All');
    setSelectedCollection(searchParams.get('collection') || 'All');
    setSelectedBrand(searchParams.get('brand') || 'All');
    setQuery(searchParams.get('q') || '');
    setMinimumPrice(searchParams.get('minPrice') || '');
    setMaximumPrice(searchParams.get('maxPrice') || '');
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        const [productsResponse, categoriesResponse, collectionsResponse, brandsResponse] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories'),
          fetch('/api/collections'),
          fetch('/api/brands'),
        ]);
        if (!productsResponse.ok || !categoriesResponse.ok || !collectionsResponse.ok || !brandsResponse.ok) {
          throw new Error('The product catalog could not be loaded. Please try again later.');
        }
        const [data, categoryData, collectionData, brandData] = await Promise.all([
          productsResponse.json() as Promise<Product[]>,
          categoriesResponse.json() as Promise<StoreCategory[]>,
          collectionsResponse.json() as Promise<StoreCollection[]>,
          brandsResponse.json() as Promise<StoreBrand[]>,
        ]);
        if (active) {
          setProducts(data);
          setCategories(categoryData);
          setCollections(collectionData);
          setBrands(brandData);
          setLoadError('');
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'The product catalog could not be loaded.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProducts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      selectedCategory !== 'All' &&
      categories.length > 0 &&
      !categories.some((category) => category.name === selectedCategory)
    ) {
      setSelectedCategory('All');
    }
  }, [categories, selectedCategory]);

  const allCategories = ['All', ...categories.map((category) => category.name)];

  const visibleProducts = useMemo(() => {
    const searchTerms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const minimum = minimumPrice === '' ? null : Number(minimumPrice);
    const maximum = maximumPrice === '' ? null : Number(maximumPrice);
    const nextProducts = products.filter((product) =>
      (selectedCategory === 'All' || product.category === selectedCategory)
      && (selectedCollection === 'All' || product.collection === selectedCollection)
      && (selectedBrand === 'All' || product.brand === selectedBrand)
      && (minimum === null || (Number.isFinite(minimum) && product.price >= minimum))
      && (maximum === null || (Number.isFinite(maximum) && product.price <= maximum))
      && searchTerms.every((term) => [
        product.name,
        product.category,
        product.brand,
        product.collection,
        product.shortDescription,
        product.description,
        ...product.benefits,
        ...product.ingredients,
      ].some((value) => value?.toLocaleLowerCase().includes(term))),
    );

    return [...nextProducts].sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'newest') return Number(b.newArrival) - Number(a.newArrival);
      return Number(b.featured) - Number(a.featured);
    });
  }, [products, selectedCategory, selectedCollection, selectedBrand, sortBy, query, minimumPrice, maximumPrice]);

  return (
    <div className="container-shell py-10 sm:py-16">
      <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.34em] text-[#b87580]">Shop all</p>
          <h1 className="mt-3 font-serif text-3xl leading-tight text-[#382a2a] sm:text-5xl">Curated beauty essentials</h1>
        </div>

        <div className="flex w-fit items-center gap-3 rounded-full border border-[#e7d4d0] bg-white px-4 py-3 shadow-sm">
          <SlidersHorizontal size={16} className="text-[#b87580]" />
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="bg-transparent text-sm text-[#382a2a] outline-none"
            aria-label="Sort products"
          >
            <option value="featured">Featured</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="rating">Top Rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 sm:mb-6 sm:gap-3">
        {allCategories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`min-h-10 rounded-full px-3 py-2 text-xs transition sm:px-4 sm:text-sm ${
              selectedCategory === category
                ? 'bg-[#382a2a] text-white'
                : 'border border-[#e9d8d0] bg-white text-[#382a2a] hover:border-[#b87580] hover:text-[#b87580]'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <form role="search" className="mb-4 flex min-w-0 gap-2" onSubmit={(event) => event.preventDefault()}>
        <ProductSearchInput
          id="shop-product-search"
          value={query}
          onChange={setQuery}
          ariaLabel="Search products by name, category, brand, or description"
          autoFocus={searchParams.get('focus') === 'search'}
        />
      </form>

      <div className="mb-8 grid grid-cols-2 gap-2 sm:mb-10 sm:flex sm:flex-wrap sm:gap-3">
        <label className="flex min-h-10 max-w-full items-center gap-2 rounded-full border border-[#e9d8d0] bg-white px-3 py-2 text-xs text-[#5d4c4b] sm:px-4 sm:text-sm">
          <span>Collection</span>
          <select value={selectedCollection} onChange={(event) => setSelectedCollection(event.target.value)} className="max-w-40 bg-transparent text-[#382a2a] outline-none" aria-label="Filter by collection">
            <option value="All">All collections</option>
            {collections.map((collection) => <option key={collection.id} value={collection.name}>{collection.name}</option>)}
          </select>
        </label>
        <label className="flex min-h-10 max-w-full items-center gap-2 rounded-full border border-[#e9d8d0] bg-white px-3 py-2 text-xs text-[#5d4c4b] sm:px-4 sm:text-sm">
          <span>Brand</span>
          <select value={selectedBrand} onChange={(event) => setSelectedBrand(event.target.value)} className="max-w-40 bg-transparent text-[#382a2a] outline-none" aria-label="Filter by brand">
            <option value="All">All brands</option>
            {brands.map((brand) => <option key={brand.id} value={brand.name}>{brand.name}</option>)}
          </select>
        </label>
        <label className="flex min-h-10 min-w-0 items-center gap-2 rounded-full border border-[#e9d8d0] bg-white px-3 py-2 text-xs text-[#5d4c4b] sm:px-4 sm:text-sm">
          <span className="shrink-0">Min $</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={minimumPrice}
            onChange={(event) => setMinimumPrice(event.target.value)}
            aria-label="Minimum product price"
            className="w-full min-w-0 bg-transparent text-[#382a2a] outline-none"
            placeholder="0"
          />
        </label>
        <label className="flex min-h-10 min-w-0 items-center gap-2 rounded-full border border-[#e9d8d0] bg-white px-3 py-2 text-xs text-[#5d4c4b] sm:px-4 sm:text-sm">
          <span className="shrink-0">Max $</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={maximumPrice}
            onChange={(event) => setMaximumPrice(event.target.value)}
            aria-label="Maximum product price"
            className="w-full min-w-0 bg-transparent text-[#382a2a] outline-none"
            placeholder="Any"
          />
        </label>
      </div>

      {loadError ? <p role="alert" className="rounded-2xl bg-[#f9e8e5] px-4 py-3 text-sm text-[#8e3f45]">{loadError}</p> : null}
      {loading ? <p className="py-12 text-center text-sm text-[#8a6f6d]">Loading products...</p> : null}
      {!loading && !loadError && visibleProducts.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#8a6f6d]">No products match those search and filter options.</p>
      ) : null}
      {!loading && !loadError && visibleProducts.length > 0 ? (
        <>
          <p className="mb-4 text-xs text-[#8a6f6d]" aria-live="polite">
            {visibleProducts.length} {visibleProducts.length === 1 ? 'product' : 'products'}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
