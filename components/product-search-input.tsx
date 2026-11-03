"use client";

import { useEffect, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import type { Product } from '@/lib/data';

type ProductSuggestion = Pick<Product, 'slug' | 'name' | 'category' | 'price' | 'image'> & {
  brand?: string;
};

type ProductSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  id: string;
  placeholder?: string;
  ariaLabel: string;
  autoFocus?: boolean;
  className?: string;
};

export function ProductSearchInput({
  value,
  onChange,
  id,
  placeholder = 'Search products, categories, brands...',
  ariaLabel,
  autoFocus,
  className = '',
}: ProductSearchInputProps) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const trimmedQuery = value.trim();
  const showSuggestions = focused && trimmedQuery.length >= 2;

  useEffect(() => {
    setSuggestions([]);
    setActiveIndex(-1);
    setLoading(false);
    setLoadError(false);
    if (trimmedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/products/suggestions?q=${encodeURIComponent(trimmedQuery)}`,
          { cache: 'no-store', signal: controller.signal },
        );
        if (!response.ok) throw new Error('Unable to load product suggestions.');
        const result = await response.json() as { suggestions?: ProductSuggestion[] };
        setSuggestions(result.suggestions ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Unable to load product suggestions:', error);
          setSuggestions([]);
          setLoadError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery]);

  const goToSearchResults = () => {
    if (trimmedQuery) router.push(`/shop?q=${encodeURIComponent(trimmedQuery)}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      router.push(`/products/${encodeURIComponent(suggestions[activeIndex].slug)}`);
      setFocused(false);
    } else if (event.key === 'Enter' && trimmedQuery) {
      event.preventDefault();
      goToSearchResults();
      setFocused(false);
    } else if (event.key === 'Escape') {
      setFocused(false);
    }
  };

  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <div className="flex min-h-11 min-w-0 items-center gap-2 rounded-full border border-[#e9d8d0] bg-white px-4">
        <label htmlFor={id} className="flex min-w-0 flex-1 items-center gap-2">
          <Search size={17} className="shrink-0 text-[#b87580]" />
          <input
            id={id}
            name="q"
            type="search"
            role="combobox"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setActiveIndex(-1);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={ariaLabel}
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls={`${id}-suggestions`}
            autoComplete="off"
            autoFocus={autoFocus}
            className="min-w-0 flex-1 bg-transparent text-sm text-[#382a2a] outline-none placeholder:text-[#a5908e]"
          />
        </label>
        {value ? (
          <button
            type="button"
            aria-label="Clear product search"
            onClick={() => {
              onChange('');
              setSuggestions([]);
              setActiveIndex(-1);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8a6f6d]"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      {showSuggestions ? (
        <div
          id={`${id}-suggestions`}
          role="listbox"
          aria-label="Product suggestions"
          className="absolute left-0 right-0 top-full z-[70] mt-2 max-h-[min(70vh,28rem)] overflow-y-auto rounded-2xl border border-[#eadcdf] bg-white p-2 shadow-xl"
        >
          {loading && suggestions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-[#8a6f6d]">Finding products...</p>
          ) : loadError ? (
            <p className="px-3 py-3 text-sm text-[#8a6f6d]">Suggestions are unavailable. Press Enter to search the store.</p>
          ) : suggestions.length > 0 ? (
            <>
              {suggestions.map((product, index) => (
                <button
                  key={product.slug}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    router.push(`/products/${encodeURIComponent(product.slug)}`);
                    setFocused(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${activeIndex === index ? 'bg-[#f7efee]' : 'hover:bg-[#faf7f4]'}`}
                >
                  <img src={product.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[#382a2a]">{product.name}</span>
                    <span className="block truncate text-xs text-[#8a6f6d]">{product.category}{product.brand ? ` · ${product.brand}` : ''}</span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-[#382a2a]">${product.price.toFixed(2)}</span>
                </button>
              ))}
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={goToSearchResults}
                className="mt-1 w-full rounded-xl border-t border-[#f0dfda] px-3 py-3 text-left text-sm font-medium text-[#9b626d] hover:bg-[#faf7f4]"
              >
                See all results for “{trimmedQuery}”
              </button>
            </>
          ) : (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={goToSearchResults}
              className="w-full rounded-xl px-3 py-3 text-left text-sm text-[#8a6f6d] hover:bg-[#faf7f4]"
            >
              No exact matches. Search the store for “{trimmedQuery}”.
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
