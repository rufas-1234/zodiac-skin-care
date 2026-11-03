export type Product = {
  id: number;
  slug: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  badge: string;
  image: string;
  shortDescription: string;
  description: string;
  ingredients: string[];
  benefits: string[];
  sizes: string[];
  stock: number;
  featured: boolean;
  newArrival: boolean;
  placements?: string[];
  collection: string;
  brand?: string;
  unitsSold?: number;
  viewCount?: number;
  engagementSeconds?: number;
};

export type DefaultBlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  image: string;
  author: string;
};

export const announcements = [
  'Free shipping on every order over $75',
  'New seasonal glow ritual now available',
  'Members receive 15% off first order',
];

export const benefits = [
  { name: 'Clean Ingredients', icon: 'leaf' },
  { name: 'Dermatologically Tested', icon: 'sparkles' },
  { name: 'Cruelty Free', icon: 'shield' },
  { name: 'Sustainable Beauty', icon: 'recycle' },
];

export const categories = [
  { name: 'Skincare', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80' },
  { name: 'Makeup', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80' },
  { name: 'Haircare', image: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80' },
  { name: 'Bodycare', image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80' },
  { name: 'Sun Care', image: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=80' },
  { name: 'Gift Sets', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80' },
];

export const defaultProducts: Product[] = [
  {
    id: 1,
    slug: 'rose-hydration-serum',
    name: 'Rose Hydration Serum',
    category: 'Skincare',
    price: 56,
    originalPrice: 72,
    rating: 4.9,
    reviews: 248,
    badge: 'Bestseller',
    image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=900&q=80',
    shortDescription: 'A weightless skin-plumping serum for a dewy finish.',
    description:
      'This silky serum deeply hydrates with rosewater, peptides, and squalane to visibly smooth texture and restore bounce for soft, radiant skin.',
    ingredients: ['Rosewater', 'Peptides', 'Squalane', 'Hyaluronic Acid'],
    benefits: ['Instant hydration', 'Strengthens the skin barrier', 'Soft-focus glow'],
    sizes: ['30 ml', '50 ml'],
    stock: 18,
    featured: true,
    newArrival: true,
    collection: 'Glow Ritual',
  },
  {
    id: 2,
    slug: 'velvet-glow-foundation',
    name: 'Velvet Glow Foundation',
    category: 'Makeup',
    price: 48,
    originalPrice: 60,
    rating: 4.8,
    reviews: 188,
    badge: 'New',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80',
    shortDescription: 'Medium-coverage complexion with a soft satin finish.',
    description:
      'A cushion-light foundation that delivers natural-looking coverage with a satin finish and lasting comfort for all-day wear.',
    ingredients: ['Ceramide', 'Vitamin E', 'Niacinamide'],
    benefits: ['Buildable coverage', 'Comfortable wear', 'Seamless finish'],
    sizes: ['15 ml', '30 ml'],
    stock: 12,
    featured: true,
    newArrival: false,
    collection: 'Soft Luxe',
  },
  {
    id: 3,
    slug: 'nourishing-botanical-cream',
    name: 'Nourishing Botanical Cream',
    category: 'Bodycare',
    price: 42,
    rating: 4.7,
    reviews: 94,
    badge: 'Editor Pick',
    image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80',
    shortDescription: 'A rich, buttery body cream for daily softness.',
    description:
      'This body cream melts into skin with shea butter and oat milk to restore moisture and leave the skin soft, nourished and calm.',
    ingredients: ['Shea Butter', 'Oat Milk', 'Squalane'],
    benefits: ['Deep hydration', 'Soothes dryness', 'Silky texture'],
    sizes: ['200 ml', '400 ml'],
    stock: 27,
    featured: false,
    newArrival: true,
    collection: 'Daily Ritual',
  },
  {
    id: 4,
    slug: 'golden-veil-sunscreen',
    name: 'Golden Veil SPF 50',
    category: 'Sun Care',
    price: 38,
    originalPrice: 46,
    rating: 4.9,
    reviews: 256,
    badge: 'Top Rated',
    image: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=80',
    shortDescription: 'Lightweight mineral sunscreen for a glass-skin finish.',
    description:
      'Broad-spectrum UVA/UVB protection with a featherlight finish that layers beautifully under makeup and leaves skin luminous.',
    ingredients: ['Zinc Oxide', 'Vitamin E', 'Bisabolol'],
    benefits: ['Broad spectrum', 'Non-greasy finish', 'Daily protection'],
    sizes: ['50 ml'],
    stock: 21,
    featured: true,
    newArrival: true,
    collection: 'Sun Ritual',
  },
  {
    id: 5,
    slug: 'silk-bloom-hair-oil',
    name: 'Silk Bloom Hair Oil',
    category: 'Haircare',
    price: 45,
    rating: 4.8,
    reviews: 133,
    badge: 'Best for Shine',
    image: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80',
    shortDescription: 'A reparative oil that adds shine and reduces frizz.',
    description:
      'This nourishing leave-in hair oil smooths flyaways and adds healthy shine without heaviness, ideal for everyday styling.',
    ingredients: ['Argan Oil', 'Camellia Seed Oil', 'Vitamin A'],
    benefits: ['Frizz control', 'Soft shine', 'Thermal protection'],
    sizes: ['30 ml', '60 ml'],
    stock: 16,
    featured: false,
    newArrival: true,
    collection: 'Smooth & Shine',
  },
  {
    id: 6,
    slug: 'signature-glow-set',
    name: 'Signature Glow Set',
    category: 'Gift Sets',
    price: 86,
    originalPrice: 110,
    rating: 5,
    reviews: 72,
    badge: 'Gift Favorite',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80',
    shortDescription: 'A curated 3-step ritual for glowing skin and gifting.',
    description:
      'This premium gift set includes our bestselling cleanser, serum and cream for an at-home glow ritual that feels instantly luxurious.',
    ingredients: ['Rosewater', 'Hyaluronic Acid', 'Squalane'],
    benefits: ['Spa-like routine', 'Gift-ready packaging', 'Travel-friendly'],
    sizes: ['3-piece set'],
    stock: 9,
    featured: true,
    newArrival: false,
    collection: 'Limited Edition',
  },
];

export const products: Product[] = defaultProducts;

export const defaultBlogPosts: DefaultBlogPost[] = [
  {
    slug: 'three-habits-for-soft-skin',
    title: 'Three habits for your softest skin yet',
    excerpt: 'A gentle, consistent routine can do more for your skin than a crowded shelf. Start with these three simple habits.',
    content: 'Great skincare starts with consistency, not complexity.\n\nCleanse gently. Choose a cleanser that leaves your skin comfortable rather than tight, and avoid scrubbing when your skin feels sensitive.\n\nMoisturize while skin is still slightly damp. This helps keep your routine comfortable and supports the skin barrier throughout the day.\n\nWear sunscreen every morning. Daily sun protection is one of the most dependable ways to care for your skin over time.\n\nIntroduce new products one at a time and give your routine room to work. A few thoughtful steps can make everyday care feel like a ritual.',
    category: 'Skincare',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
    author: 'Zodiac Beauty',
  },
  {
    slug: 'build-a-glow-first-routine',
    title: 'How to build a glow-first beauty routine',
    excerpt: 'Layer lightweight hydration and nourishing care for a radiant routine that fits your real life.',
    content: 'A glow-first routine is about comfortable, healthy-looking skin—not piling on products.\n\nStart with a clean base, then apply a hydrating serum to support a fresh, dewy finish. Follow with a moisturizer suited to your skin and the climate you live in.\n\nIn the morning, finish with broad-spectrum sunscreen. In the evening, keep the same gentle rhythm and let your skin rest between active treatments.\n\nThe best routine is one you enjoy using. Pay attention to how your skin feels, make changes gradually, and choose products that work well together.',
    category: 'Lifestyle',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
    author: 'Zodiac Beauty',
  },
  {
    slug: 'clean-ingredients-to-look-for',
    title: 'The clean ingredients list to look for',
    excerpt: 'Learn how to read an ingredient list with confidence and find formulas that support your skin goals.',
    content: 'Ingredient lists can feel intimidating, but a few practical habits make them easier to understand.\n\nLook for ingredients that match your goals. Glycerin and hyaluronic acid are common humectants; ceramides and squalane can help support a comfortable-feeling skin barrier.\n\nConsider the full formula rather than judging a product by one headline ingredient. Concentration, formulation, and how often you use a product all matter.\n\nPatch test unfamiliar products and consult a dermatologist if you have persistent irritation or specific skin concerns. Thoughtful choices should feel informed and personal.',
    category: 'Education',
    image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1200&q=80',
    author: 'Zodiac Beauty',
  },
];

export const testimonials = [
  {
    name: 'Aisha M.',
    title: 'Verified Customer',
    quote: 'The texture is unbelievably luxurious and my skin looks radiant within days.',
    rating: 5,
  },
  {
    name: 'Maya T.',
    title: 'Glow Ritual Subscriber',
    quote: 'Everything feels elevated from the packaging to the results. It is my new daily ritual.',
    rating: 5,
  },
  {
    name: 'Sofia R.',
    title: 'Beauty Editor',
    quote: 'The sunscreen layers beautifully under makeup and never feels greasy.',
    rating: 5,
  },
];

export const collections = [
  {
    title: 'Winter Radiance',
    subtitle: 'Hydration for the season',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Glow Ritual',
    subtitle: 'Curated 3-step skincare',
    image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Limited Edit',
    subtitle: 'A celebration of soft luxury',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
  },
];
