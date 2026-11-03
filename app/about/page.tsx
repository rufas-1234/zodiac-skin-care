import { Clock3, Mail, MapPin, Phone } from 'lucide-react';

import { HeroImageSlider } from '@/components/hero-image-slider';
import { getSiteContent } from '@/lib/store';
import { DEFAULT_HERO_SLIDE_IMAGES } from '@/lib/site-content';

export const dynamic = 'force-dynamic';

type AboutTeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string;
  image: string;
};

function readTeamMembers(value: string | undefined): AboutTeamMember[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((member) =>
    typeof member === 'object'
    && member !== null
    && typeof member.id === 'string'
    && typeof member.name === 'string'
    && typeof member.role === 'string'
    && typeof member.bio === 'string'
    && typeof member.image === 'string'
  )) {
    throw new Error('About page team content is invalid.');
  }
  return parsed;
}

export default async function AboutPage() {
  const content = await getSiteContent();
  const slides = DEFAULT_HERO_SLIDE_IMAGES.map(
    (_, index) => content[`about_slide_${index + 1}`] || DEFAULT_HERO_SLIDE_IMAGES[index],
  );
  const teamMembers = readTeamMembers(content.about_team_members);
  const phone = content.contact_phone?.trim() || '';
  const phoneLink = phone.replace(/[^\d+]/g, '');
  const whatsapp = content.contact_whatsapp?.replace(/\D/g, '') || phone.replace(/\D/g, '');
  const email = content.contact_email?.trim() || '';
  const location = content.contact_location?.trim() || '';
  const address = content.contact_address?.trim() || '';
  const hours = content.contact_hours?.trim() || '';

  return (
    <div className="container-shell space-y-14 py-10 sm:space-y-20 sm:py-16">
      <section className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <p className="text-[10px] uppercase tracking-[0.34em] text-[#b87580]">{content.about_eyebrow}</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-[#382a2a] sm:text-5xl">{content.about_title}</h1>
          <p className="mt-5 text-base leading-7 text-[#5d4c4b] sm:text-lg sm:leading-8">{content.about_intro}</p>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#665351] sm:text-base sm:leading-8">{content.about_story}</p>
        </div>
        <HeroImageSlider
          images={slides}
          ariaLabel="About Zodiac Beauty image carousel"
          sectionLabel="Our story"
          caption="Thoughtful beauty, made personal"
          imageDescription="Zodiac Beauty and our approach to everyday care"
        />
      </section>

      {teamMembers.length > 0 ? (
        <section>
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <p className="text-[10px] uppercase tracking-[0.34em] text-[#b87580]">The people behind the ritual</p>
            <h2 className="mt-3 font-serif text-3xl text-[#382a2a] sm:text-4xl">Meet our team</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {teamMembers.map((member) => (
              <article key={member.id} className="overflow-hidden rounded-[24px] border border-[#f0dfda] bg-white shadow-sm">
                {member.image ? (
                  <img src={member.image} alt={member.name} className="h-64 w-full object-cover sm:h-72" />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-[#f7efee] font-serif text-5xl text-[#b87580]">
                    {member.name.trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-serif text-2xl text-[#382a2a]">{member.name}</h3>
                  {member.role ? <p className="mt-1 text-sm font-medium text-[#b87580]">{member.role}</p> : null}
                  {member.bio ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#665351]">{member.bio}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] bg-[#f7efee] p-5 sm:p-8 lg:p-10">
        <div className="mb-6 max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.34em] text-[#b87580]">We’re here to help</p>
          <h2 className="mt-2 font-serif text-3xl text-[#382a2a] sm:text-4xl">Visit or get in touch</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {phone ? (
            <a href={`tel:${phoneLink}`} className="rounded-2xl border border-[#eddad6] bg-white p-5 transition hover:border-[#b87580]">
              <Phone size={19} className="text-[#b87580]" />
              <span className="mt-3 block text-sm font-medium text-[#382a2a]">Call us</span>
              <span className="mt-1 block break-words text-sm text-[#665351]">{phone}</span>
            </a>
          ) : null}
          {whatsapp ? (
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="rounded-2xl border border-[#eddad6] bg-white p-5 transition hover:border-[#b87580]">
              <Phone size={19} className="text-[#b87580]" />
              <span className="mt-3 block text-sm font-medium text-[#382a2a]">WhatsApp</span>
              <span className="mt-1 block text-sm text-[#665351]">Chat with our team</span>
            </a>
          ) : null}
          {email ? (
            <a href={`mailto:${email}`} className="rounded-2xl border border-[#eddad6] bg-white p-5 transition hover:border-[#b87580]">
              <Mail size={19} className="text-[#b87580]" />
              <span className="mt-3 block text-sm font-medium text-[#382a2a]">Email</span>
              <span className="mt-1 block break-words text-sm text-[#665351]">{email}</span>
            </a>
          ) : null}
          {location ? (
            <div className="rounded-2xl border border-[#eddad6] bg-white p-5">
              <MapPin size={19} className="text-[#b87580]" />
              <span className="mt-3 block text-sm font-medium text-[#382a2a]">Location</span>
              <span className="mt-1 block text-sm text-[#665351]">{location}</span>
              {address ? <span className="mt-1 block text-xs leading-5 text-[#8a6f6d]">{address}</span> : null}
            </div>
          ) : null}
        </div>
        {hours ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-[#665351]">
            <Clock3 size={16} className="shrink-0 text-[#b87580]" /> {hours}
          </p>
        ) : null}
      </section>
    </div>
  );
}
