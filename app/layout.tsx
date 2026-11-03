import '@/app/globals.css';

import type { Metadata } from 'next';

import { CartProvider } from '@/components/cart-provider';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { StoreContactProvider } from '@/components/store-contact-provider';

export const metadata: Metadata = {
  title: 'Zodiac Beauty | Luxury Skincare & Cosmetics',
  description: 'Premium beauty essentials for radiant skin, modern rituals, and effortless confidence.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <StoreContactProvider>
            <Header />
            <main>{children}</main>
            <Footer />
          </StoreContactProvider>
        </CartProvider>
      </body>
    </html>
  );
}
