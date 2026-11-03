import { Clock3, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';

import { getSiteContent } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const content = await getSiteContent();
  const phone = content.contact_phone?.trim() || '';
  const phoneLink = phone.replace(/[^\d+]/g, '');
  const whatsapp = content.contact_whatsapp?.replace(/\D/g, '') || phone.replace(/\D/g, '');
  const email = content.contact_email?.trim() || '';
  const location = content.contact_location?.trim() || '';
  const address = content.contact_address?.trim() || '';
  const hours = content.contact_hours?.trim() || '';
  const message = content.contact_message?.trim() || '';
  const whatsappUrl = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent('Hello Zodiac Beauty, I have a question about your products.')}`
    : '';

  return (
    <div className="container-shell py-10 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <p className="text-[10px] uppercase tracking-[0.34em] text-[#b87580]">Contact us</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-[#382a2a] sm:text-5xl">Let’s talk beauty.</h1>
        {message ? <p className="mt-4 max-w-2xl text-base leading-7 text-[#665351]">{message}</p> : null}

        <div className="mt-7 grid gap-3 sm:mt-10 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {phone ? (
            <a href={`tel:${phoneLink}`} className="section-card flex items-start gap-4 p-6 transition hover:border-[#b87580]">
              <Phone className="mt-1 shrink-0 text-[#b87580]" size={20} />
              <span><span className="block font-medium text-[#382a2a]">Call us</span><span className="mt-2 block break-words text-sm text-[#665351]">{phone}</span></span>
            </a>
          ) : null}
          {whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="section-card flex items-start gap-4 p-6 transition hover:border-[#b87580]">
              <MessageCircle className="mt-1 shrink-0 text-[#b87580]" size={20} />
              <span><span className="block font-medium text-[#382a2a]">WhatsApp</span><span className="mt-2 block text-sm text-[#665351]">Chat with Zodiac Beauty</span></span>
            </a>
          ) : null}
          {email ? (
            <a href={`mailto:${email}`} className="section-card flex items-start gap-4 p-6 transition hover:border-[#b87580]">
              <Mail className="mt-1 shrink-0 text-[#b87580]" size={20} />
              <span><span className="block font-medium text-[#382a2a]">Email</span><span className="mt-2 block break-words text-sm text-[#665351]">{email}</span></span>
            </a>
          ) : null}
          {location ? (
            <div className="section-card flex items-start gap-4 p-6">
              <MapPin className="mt-1 shrink-0 text-[#b87580]" size={20} />
              <span><span className="block font-medium text-[#382a2a]">Location</span><span className="mt-2 block text-sm text-[#665351]">{location}</span>{address ? <span className="mt-1 block text-xs leading-5 text-[#8a6f6d]">{address}</span> : null}</span>
            </div>
          ) : null}
        </div>
        {hours ? (
          <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-[#f0dfda] bg-white p-5 text-sm text-[#665351] sm:mt-6 sm:rounded-[24px] sm:p-6">
            <Clock3 className="shrink-0 text-[#b87580]" size={18} />
            <span>{hours}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
