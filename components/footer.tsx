"use client";

import Link from 'next/link';
import { Camera, Mail, MapPin, Phone, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { useStoreContact } from '@/components/store-contact-provider';

export function Footer() {
  const { phone, phoneLink, email, location } = useStoreContact();
  return (
    <footer className="mt-20 bg-[#382a2a] text-[#f9f5f3]">
      <div className="mx-auto grid grid-cols-2 gap-x-6 gap-y-10 px-4 py-16 sm:grid-cols-4 sm:px-6 lg:grid-cols-5 lg:px-8">
        <div className="col-span-2 sm:col-span-4 lg:col-span-2">
          <Link href="/" aria-label="Zodiac International Distributors home" className="mb-4 inline-flex">
            <BrandLogo className="h-16 w-[176px] sm:h-[72px] sm:w-[190px]" />
          </Link>
          <p className="max-w-md text-sm leading-7 text-[#eadad5]">
            Thoughtful skincare, makeup, and self-care essentials designed to bring ritual, radiance, and softness to everyday routines.
          </p>
          <div className="mt-6 flex gap-3">
            {[Camera, Sparkles, Mail].map((Icon, idx) => (
              <a
                key={idx}
                href="#"
                className="rounded-full border border-[#7d5c5a] p-2 text-[#f8e4e2] transition hover:border-[#dca7a1] hover:text-white"
                aria-label="Social media"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-1">
          <h3 className="mb-4 text-sm uppercase tracking-[0.2em] text-[#f4d8d3]">Quick Links</h3>
          <ul className="space-y-3 text-sm text-[#eadad5]">
            <li><Link href="/shop">Shop</Link></li>
            <li><Link href="/collections">Collections</Link></li>
            <li><Link href="/brands">Brands</Link></li>
            <li><Link href="/about">About</Link></li>
            <li><Link href="/blog">Journal</Link></li>
          </ul>
        </div>

        <div className="sm:col-span-2 lg:col-span-1">
          <h3 className="mb-4 text-sm uppercase tracking-[0.2em] text-[#f4d8d3]">Customer Care</h3>
          <ul className="space-y-3 text-sm text-[#eadad5]">
            <li>Shipping & Delivery</li>
            <li>Returns & Refunds</li>
            <li>Privacy Policy</li>
            <li>Terms & Conditions</li>
          </ul>
        </div>

        <div className="col-span-2 sm:col-span-4 lg:col-span-1">
          <h3 className="mb-4 text-sm uppercase tracking-[0.2em] text-[#f4d8d3]">Contact</h3>
          <ul className="space-y-3 text-sm text-[#eadad5]">
            {location ? <li className="flex items-center gap-2"><MapPin size={14} /> {location}</li> : null}
            {phone ? <li><a href={`tel:${phoneLink}`} className="flex items-center gap-2"><Phone size={14} /> {phone}</a></li> : null}
            {email ? <li><a href={`mailto:${email}`} className="flex items-center gap-2"><Mail size={14} /> {email}</a></li> : null}
          </ul>
        </div>
      </div>

      <div className="border-t border-[#5b4445] py-5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-[#eadad5] sm:flex-row sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            <span className="flex items-center gap-2"><Truck size={14} /> Free shipping over $75</span>
            <span className="flex items-center gap-2"><ShieldCheck size={14} /> Secure checkout</span>
          </div>
          <p className="text-center text-[#eadad5]">© 2026 Zodiac Beauty. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
