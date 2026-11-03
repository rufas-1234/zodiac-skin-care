"use client";

import { MessageCircle, PhoneCall } from 'lucide-react';

import type { Product } from '@/lib/data';
import { storePhoneLink, storeWhatsAppNumber } from '@/lib/store-contact';

export function ProductOrderLinks({
  product,
  compact = false,
  quantity = 1,
}: {
  product: Product;
  compact?: boolean;
  quantity?: number;
}) {
  const message = `Hi, I’d like to order ${product.name} (quantity: ${quantity}) for $${product.price} each.`;
  const whatsappUrl = `https://wa.me/${storeWhatsAppNumber}?text=${encodeURIComponent(message)}`;
  const linkClass = compact
    ? 'inline-flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-full border border-[#e9d8d0] px-1.5 py-2 text-[10px] font-medium text-[#382a2a] transition hover:border-[#b87580] hover:text-[#9b626d] sm:gap-1.5 sm:px-3 sm:text-xs'
    : 'inline-flex items-center justify-center gap-2 rounded-full border border-[#e9d8d0] px-4 py-3 text-sm font-medium text-[#382a2a] transition hover:border-[#b87580] hover:text-[#9b626d]';

  return (
    <div className={`grid grid-cols-2 gap-2 ${compact ? 'mt-3' : ''}`}>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${linkClass} border-[#b8d9c3] text-[#356a49] hover:border-[#356a49] hover:text-[#28523a]`}
      >
        <MessageCircle size={compact ? 14 : 16} />
        {compact ? 'WhatsApp' : 'Order on WhatsApp'}
      </a>
      <a href={`tel:${storePhoneLink}`} className={linkClass}>
        <PhoneCall size={compact ? 14 : 16} />
        {compact ? 'Call' : 'Call about product'}
      </a>
    </div>
  );
}
