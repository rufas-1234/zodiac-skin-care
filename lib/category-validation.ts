import { categories as defaultCategories } from '@/lib/data';
import { slugify } from '@/lib/store';

export class CategoryValidationError extends Error {}

export type CategoryDraft = {
  name: string;
  slug: string;
  image: string;
};

function categoryObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CategoryValidationError('Category data must be an object.');
  }
  return value as Record<string, unknown>;
}

export function parseCategoryInput(value: unknown): CategoryDraft {
  const input = categoryObject(value);
  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new CategoryValidationError('Category name is required.');
  }
  const name = input.name.trim();
  if (name.length > 60) {
    throw new CategoryValidationError('Category name must be at most 60 characters.');
  }

  const slug = slugify(name);
  if (!slug || slug.length > 80) {
    throw new CategoryValidationError('Category name must include letters or numbers.');
  }

  const defaultImage = defaultCategories.find(
    (category) => category.name.toLowerCase() === name.toLowerCase(),
  )?.image ?? defaultCategories[0]?.image ?? '';
  const rawImage = input.image === undefined ? defaultImage : input.image;
  if (typeof rawImage !== 'string' || rawImage.trim().length > 2048) {
    throw new CategoryValidationError('Category image must be a URL under 2,048 characters.');
  }

  return { name, slug, image: rawImage.trim() || defaultImage };
}
