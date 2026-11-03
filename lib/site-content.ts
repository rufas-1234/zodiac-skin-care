export const DEFAULT_HERO_SLIDE_IMAGES = [
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1100&q=80',
  'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1100&q=80',
  'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1100&q=80',
  'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1100&q=80',
] as const;

export type AboutTeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string;
  image: string;
};

export const DEFAULT_SITE_CONTENT: Record<string, string> = {
  hero_badge: 'Luxury beauty essentials',
  hero_title: 'Radiant Skin. Real Confidence.',
  hero_subtitle:
    'Thoughtful formulas, elevated rituals, and soft-luxe textures that help you glow beautifully from morning to night.',
  hero_slide_1: DEFAULT_HERO_SLIDE_IMAGES[0],
  hero_slide_2: DEFAULT_HERO_SLIDE_IMAGES[1],
  hero_slide_3: DEFAULT_HERO_SLIDE_IMAGES[2],
  hero_slide_4: DEFAULT_HERO_SLIDE_IMAGES[3],
  about_eyebrow: 'Our story',
  about_title: 'Beauty rituals with intention.',
  about_intro:
    'Zodiac Beauty was created to bring soft luxury and science-backed self-care into a joyful daily ritual.',
  about_story:
    'We believe skincare and beauty should feel refined, nourishing, and confidence-boosting at every step. Our collection is thoughtfully chosen to make everyday care feel like a moment for yourself.',
  about_slide_1: DEFAULT_HERO_SLIDE_IMAGES[0],
  about_slide_2: DEFAULT_HERO_SLIDE_IMAGES[1],
  about_slide_3: DEFAULT_HERO_SLIDE_IMAGES[2],
  about_slide_4: DEFAULT_HERO_SLIDE_IMAGES[3],
  about_team_members: '[]',
  contact_phone: process.env.NEXT_PUBLIC_STORE_PHONE?.trim() || '+254 185167903',
  contact_whatsapp: (process.env.NEXT_PUBLIC_STORE_PHONE?.trim() || '+254 185167903').replace(/\D/g, ''),
  contact_email: 'hello@zodiacbeauty.co',
  contact_location: 'Nairobi, Kenya',
  contact_address: '',
  contact_hours: 'Monday–Saturday, 9:00 AM–6:00 PM EAT',
  contact_message:
    'Need help choosing a product or have a question about an order? Call or message our team and we’ll be happy to help.',
  sale_title: 'Glow brighter with 30% off your ritual.',
  sale_description: 'Discover our limited-time skincare duo and save on your daily glow essentials.',
  brand_story: 'Zodiac Beauty creates elevated rituals that blend skincare science with soft-luxe beauty experiences.',
};
