import { slugify, type BlogPostDraft, type CatalogResourceDraft, type StoreBrandDraft } from '@/lib/store';

export class CatalogValidationError extends Error {}

export function isDuplicateCatalogEntry(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
    || error instanceof Error && /unique constraint/i.test(error.message);
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CatalogValidationError('Submitted data must be an object.');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, limit: number, required = false) {
  if (typeof value !== 'string') {
    throw new CatalogValidationError(`${field} must be text.`);
  }
  const result = value.trim();
  if (required && !result) {
    throw new CatalogValidationError(`${field} is required.`);
  }
  if (result.length > limit) {
    throw new CatalogValidationError(`${field} must be at most ${limit} characters.`);
  }
  return result;
}

function imagePath(value: unknown) {
  const image = text(value, 'Image', 2048, true);
  if (image.startsWith('/')) {
    if (image.startsWith('//') || image.split('/').includes('..')) {
      throw new CatalogValidationError('Image must use a valid local path or HTTP(S) URL.');
    }
    return image;
  }
  let url: URL;
  try {
    url = new URL(image);
  } catch {
    throw new CatalogValidationError('Image must use a valid local path or HTTP(S) URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CatalogValidationError('Image must use a valid local path or HTTP(S) URL.');
  }
  return image;
}

export function parseCatalogResource(value: unknown): CatalogResourceDraft {
  const input = record(value);
  const name = text(input.name, 'Name', 120, true);
  const slug = slugify(name);
  if (!slug || slug.length > 140) {
    throw new CatalogValidationError('Name must contain letters or numbers.');
  }
  return {
    name,
    slug,
    description: text(input.description ?? '', 'Description', 10000),
    image: imagePath(input.image),
  };
}

export function parseBrandInput(value: unknown): StoreBrandDraft {
  return parseCatalogResource(value);
}

export function parseBlogPostInput(value: unknown): BlogPostDraft {
  const input = record(value);
  const title = text(input.title, 'Title', 180, true);
  const slug = slugify(title);
  if (!slug || slug.length > 180) {
    throw new CatalogValidationError('Title must contain letters or numbers.');
  }
  if (typeof input.published !== 'boolean') {
    throw new CatalogValidationError('Publication status must be selected.');
  }
  return {
    slug,
    title,
    excerpt: text(input.excerpt, 'Excerpt', 500, true),
    content: text(input.content, 'Article content', 50000, true),
    category: text(input.category, 'Category', 80, true),
    image: imagePath(input.image),
    author: text(input.author, 'Author', 120, true),
    published: input.published,
  };
}
