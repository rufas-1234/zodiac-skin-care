"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Heart, Menu, Phone, Search, ShoppingBag, UserRound, X } from 'lucide-react';

import { BrandLogo } from '@/components/brand-logo';
import { ProductSearchInput } from '@/components/product-search-input';
import { useStoreContact } from '@/components/store-contact-provider';
import { announcements } from '@/lib/data';
import { useCart } from '@/components/cart-provider';

export function Header() {
  const { itemCount } = useCart();
  const { phone, phoneLink } = useStoreContact();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Shop', href: '/shop' },
    { label: 'Collections', href: '/collections' },
    { label: 'Brands', href: '/brands' },
    { label: 'About Us', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#e9d8d0] bg-[#faf7f4]/95 backdrop-blur-md">
      <div className="bg-[#382a2a] px-4 py-2 text-center text-xs font-medium tracking-[0.18em] text-[#faf7f4] uppercase sm:text-[11px]">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 overflow-hidden whitespace-nowrap">
          {announcements.map((announcement, index) => (
            <span key={announcement} className={index > 0 ? 'hidden sm:inline' : ''}>
              {announcement}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2" onClick={() => setMenuOpen(false)}>
          <BrandLogo className="h-9 w-[122px] max-[359px]:h-8 max-[359px]:w-[108px] sm:h-[42px] sm:w-[146px] lg:h-[46px] lg:w-[160px] xl:h-[50px] xl:w-[172px]" />
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-[#382a2a] xl:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-[#b87580]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <a href={`tel:${phoneLink}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e9d8d0] text-xs text-[#382a2a] transition hover:border-[#b87580] hover:text-[#b87580] sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-2.5" aria-label={`Call Zodiac Beauty at ${phone}`}>
            <Phone size={16} />
            <span className="hidden sm:inline">{phone}</span>
          </a>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e9d8d0] text-[#382a2a] transition hover:border-[#b87580] hover:text-[#b87580] max-[359px]:hidden"
            aria-label={searchOpen ? 'Close product search' : 'Search products'}
            aria-expanded={searchOpen}
            aria-controls="header-product-search"
            onClick={() => {
              setSearchOpen((open) => !open);
              setMenuOpen(false);
            }}
          >
            <Search size={18} />
          </button>
          <Link href="/account" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e9d8d0] text-[#382a2a] transition hover:border-[#b87580] hover:text-[#b87580] max-[359px]:hidden" aria-label="Account">
            <UserRound size={18} />
          </Link>
          <button type="button" className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e9d8d0] text-[#382a2a] transition hover:border-[#b87580] hover:text-[#b87580] sm:flex" aria-label="Wishlist">
            <Heart size={18} />
          </button>
          <Link href="/cart" className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e9d8d0] bg-[#f7efee] text-[#382a2a] transition hover:border-[#b87580] hover:text-[#b87580]" aria-label="Cart">
            <ShoppingBag size={18} />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#b87580] px-1 text-[10px] font-semibold text-white">
                {itemCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e9d8d0] text-[#382a2a] transition hover:border-[#b87580] hover:text-[#b87580] xl:hidden"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>
      {menuOpen ? (
        <nav id="mobile-primary-navigation" aria-label="Mobile navigation" className="border-t border-[#e9d8d0] bg-[#faf7f4] px-4 py-3 xl:hidden">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-1 sm:grid-cols-3">
            <Link href="/shop?focus=search" onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-[#9b626d] hover:bg-[#f4e8e5]">
              <Search size={16} /> Search products
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 items-center rounded-xl px-3 text-sm text-[#382a2a] transition hover:bg-[#f4e8e5] hover:text-[#b87580]"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/account" onClick={() => setMenuOpen(false)} className="hidden min-h-11 items-center rounded-xl px-3 text-sm text-[#382a2a] transition hover:bg-[#f4e8e5] hover:text-[#b87580] max-[359px]:flex">
              My account
            </Link>
            <a href={`tel:${phoneLink}`} onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-[#9b626d] hover:bg-[#f4e8e5]">
              Call {phone}
            </a>
          </div>
        </nav>
      ) : null}
      {searchOpen ? (
        <form
          id="header-product-search"
          action="/shop"
          role="search"
          className="border-t border-[#e9d8d0] bg-[#faf7f4] px-4 py-3"
          onSubmit={() => setSearchOpen(false)}
        >
          <div className="mx-auto flex max-w-7xl gap-2">
            <ProductSearchInput
              id="header-product-search-input"
              value={searchQuery}
              onChange={setSearchQuery}
              ariaLabel="Search products by name, category, or brand"
              autoFocus
            />
            <button type="submit" className="min-h-11 rounded-full bg-[#382a2a] px-5 text-sm font-medium text-white hover:bg-[#b87580]">
              Search
            </button>
          </div>
        </form>
      ) : null}
    </header>
  );
}
