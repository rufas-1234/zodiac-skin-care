"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_SITE_CONTENT } from '@/lib/site-content';

export type StoreContactDetails = {
  phone: string;
  phoneLink: string;
  whatsapp: string;
  email: string;
  location: string;
};

const StoreContactContext = createContext<StoreContactDetails | null>(null);

function makeContactDetails(content: Record<string, string>): StoreContactDetails {
  const phone = content.contact_phone?.trim() || DEFAULT_SITE_CONTENT.contact_phone;
  return {
    phone,
    phoneLink: phone.replace(/[^\d+]/g, ''),
    whatsapp: content.contact_whatsapp?.replace(/\D/g, '') || phone.replace(/\D/g, ''),
    email: content.contact_email?.trim() || '',
    location: content.contact_location?.trim() || '',
  };
}

export function StoreContactProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState(DEFAULT_SITE_CONTENT);

  useEffect(() => {
    let active = true;
    void fetch('/api/site-content', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load current store contact details.');
        return response.json() as Promise<Record<string, string>>;
      })
      .then((data) => {
        if (active) setContent({ ...DEFAULT_SITE_CONTENT, ...data });
      })
      .catch((error: unknown) => {
        console.error('Unable to load store contact details:', error);
      });
    return () => {
      active = false;
    };
  }, []);

  const details = useMemo(() => makeContactDetails(content), [content]);
  return <StoreContactContext.Provider value={details}>{children}</StoreContactContext.Provider>;
}

export function useStoreContact() {
  const contact = useContext(StoreContactContext);
  if (!contact) throw new Error('Store contact details must be used within StoreContactProvider.');
  return contact;
}
