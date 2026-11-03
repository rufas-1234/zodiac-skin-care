import { defaultProducts, type Product } from '@/lib/data';
import { slugify, type ProductDraft } from '@/lib/store';

export class ProductValidationError extends Error {}

const builtInPlacements = new Set([
  'featured',
  'new_arrivals',
  'shop_by_category',
  'seasonal_offer',
  'festive_season',
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProductValidationError('Product data must be an object.');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, fallback: string, field: string, maxLength: number) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'string') {
    throw new ProductValidationError(`${field} must be text.`);
  }

  const result = value.trim();
  if (result.length > maxLength) {
    throw new ProductValidationError(`${field} must be at most ${maxLength} characters.`);
  }
  return result;
}

function numeric(value: unknown, fallback: number, field: string) {
  if (value === undefined) {
    return fallback;
  }
  const result = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(result)) {
    throw new ProductValidationError(`${field} must be a valid number.`);
  }
  return result;
}

function stringList(value: unknown, fallback: string[], field: string) {
  if (value === undefined) {
    return fallback;
  }
  const result = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : null;
  if (!result || !result.every((item) => typeof item === 'string')) {
    throw new ProductValidationError(`${field} must be a list of text values.`);
  }
  const values = result.map((item) => item.trim()).filter(Boolean);
  if (values.length > 100 || values.some((item) => item.length > 240)) {
    throw new ProductValidationError(`${field} contains too many or too-long values.`);
  }
  return values;
}

function flag(value: unknown, fallback: boolean, field: string) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    throw new ProductValidationError(`${field} must be true or false.`);
  }
  return value;
}

export function parseProductInput(value: unknown, current?: Product): ProductDraft {
  const input = asRecord(value);
  const defaults = current ?? defaultProducts[0];
  if (!defaults) {
    throw new Error('No default product is available.');
  }

  const name = text(input.name, current?.name ?? '', 'Name', 180);
  if (!name) {
    throw new ProductValidationError('Name is required.');
  }

  const category = text(input.category, defaults.category, 'Category', 60);
  if (!category) {
    throw new ProductValidationError('Choose a product category.');
  }

  const slugInput = text(input.slug, current?.slug ?? slugify(name), 'Slug', 180);
  const slug = slugify(slugInput);
  if (!slug) {
    throw new ProductValidationError('A valid product slug is required.');
  }

  const price = numeric(input.price, defaults.price, 'Price');
  const rating = numeric(input.rating, defaults.rating, 'Rating');
  const reviews = numeric(input.reviews, defaults.reviews, 'Reviews');
  const stock = numeric(input.stock, defaults.stock, 'Stock');
  if (price < 0 || price > 99999999.99) {
    throw new ProductValidationError('Price must be between 0 and 99,999,999.99.');
  }
  if (rating < 1 || rating > 5) {
    throw new ProductValidationError('Rating must be between 1 and 5.');
  }
  if (!Number.isInteger(reviews) || reviews < 0 || reviews > 4294967295) {
    throw new ProductValidationError('Reviews must be a non-negative whole number.');
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 4294967295) {
    throw new ProductValidationError('Stock must be a non-negative whole number.');
  }

  const rawOriginalPrice = input.originalPrice;
  const originalPrice =
    rawOriginalPrice === null || rawOriginalPrice === ''
      ? undefined
      : numeric(rawOriginalPrice, current?.originalPrice ?? 0, 'Original price') || undefined;
  if (originalPrice !== undefined && (originalPrice < 0 || originalPrice > 99999999.99)) {
    throw new ProductValidationError('Original price must be between 0 and 99,999,999.99.');
  }

  const legacyFeatured = flag(input.featured, defaults.featured, 'Featured');
  const legacyNewArrival = flag(input.newArrival, defaults.newArrival, 'New arrival');
  const rawPlacements = input.placements ?? [
    ...(defaults.placements ?? [
    ...(defaults.featured ? ['featured'] : []),
    ...(defaults.newArrival ? ['new_arrivals'] : []),
    ]).filter((placement) => {
      if (input.featured !== undefined && placement === 'featured') {
        return false;
      }
      return input.newArrival === undefined || placement !== 'new_arrivals';
    }),
    ...(input.featured !== undefined && legacyFeatured ? ['featured'] : []),
    ...(input.newArrival !== undefined && legacyNewArrival ? ['new_arrivals'] : []),
  ];
  if (
    !Array.isArray(rawPlacements) ||
    rawPlacements.length > 20 ||
    !rawPlacements.every(
      (placement) =>
        typeof placement === 'string' &&
          (placement === 'best_sellers' ||
            builtInPlacements.has(placement) ||
          placement.startsWith('custom:') &&
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(placement.slice('custom:'.length))),
    )
  ) {
    throw new ProductValidationError('Choose valid product placements.');
  }
  const placements = [...new Set(rawPlacements.filter((placement) => placement !== 'best_sellers'))];
  const brand = text(input.brand, current?.brand ?? '', 'Brand', 120);
  const image = text(input.image, current?.image ?? defaults.image, 'Image URL', 2048);
  if (!image) {
    throw new ProductValidationError('Choose or upload a product image.');
  }
  if (image.startsWith('/')) {
    if (image.startsWith('//') || image.split('/').includes('..')) {
      throw new ProductValidationError('Product image must use a valid local path or an HTTP(S) URL.');
    }
  } else {
    let imageUrl: URL;
    try {
      imageUrl = new URL(image);
    } catch {
      throw new ProductValidationError('Product image must use a valid local path or an HTTP(S) URL.');
    }
    if (imageUrl.protocol !== 'http:' && imageUrl.protocol !== 'https:') {
      throw new ProductValidationError('Product image must use a valid local path or an HTTP(S) URL.');
    }
  }

  return {
    slug,
    name,
    category,
    price,
    originalPrice,
    rating,
    reviews,
    badge: text(input.badge, defaults.badge, 'Badge', 80),
    image,
    shortDescription: text(input.shortDescription, defaults.shortDescription, 'Short description', 2000),
    description: text(input.description, defaults.description, 'Description', 10000),
    ingredients: stringList(input.ingredients, defaults.ingredients, 'Ingredients'),
    benefits: stringList(input.benefits, defaults.benefits, 'Benefits'),
    sizes: stringList(input.sizes, defaults.sizes, 'Sizes'),
    stock,
    featured: placements.includes('featured'),
    newArrival: placements.includes('new_arrivals'),
    placements,
    collection: text(input.collection, defaults.collection, 'Collection', 120),
    brand: brand || undefined,
  };
}
