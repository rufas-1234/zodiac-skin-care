import { createHash, randomBytes, timingSafeEqual, pbkdf2 } from 'node:crypto';
import { promisify } from 'node:util';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { categories as defaultCategories, type Product } from '@/lib/data';
import { normalizeProductImageUrl } from '@/lib/product-images';
import { getDatabase, usesLocalDevelopmentDatabase } from '@/lib/db';
import { SESSION_IDLE_TIMEOUT_SECONDS } from '@/lib/auth-constants';
import { DEFAULT_SITE_CONTENT } from '@/lib/site-content';

const pbkdf2Async = promisify(pbkdf2);
const PASSWORD_ITERATIONS = 600_000;
const SESSION_LIFETIME_SECONDS = SESSION_IDLE_TIMEOUT_SECONDS;
const PRODUCT_COLUMNS = `
  id, slug, name, category, price, original_price, rating, reviews, badge, image,
  short_description, description, ingredients, benefits, sizes, stock, featured,
  new_arrival, placements, collection, brand
`;

type ProductRow = RowDataPacket & {
  id: number;
  units_sold?: number;
  view_count?: number;
  engagement_seconds?: number;
  slug: string;
  name: string;
  category: Product['category'];
  price: string | number;
  original_price: string | number | null;
  rating: string | number;
  reviews: number;
  badge: string;
  image: string;
  short_description: string;
  description: string;
  ingredients: string | string[];
  benefits: string | string[];
  sizes: string | string[];
  stock: number;
  featured: number;
  new_arrival: number;
  placements: string | string[];
  collection: string;
  brand: string | null;
};

type UserRow = RowDataPacket & {
  id: number;
  email: string;
  name: string;
  role: string;
  password_hash: string;
  password_salt: string;
};

export type AdminUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  emailTwoFactorEnabled?: boolean;
};

export type ProductDraft = Omit<Product, 'id' | 'unitsSold' | 'viewCount' | 'engagementSeconds'>;
export type StoreCategory = {
  id: number;
  name: string;
  slug: string;
  image: string;
  productCount: number;
};
export type StoreCollection = {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  sortOrder: number;
  productCount: number;
};
export type StoreBrand = Omit<StoreCollection, 'sortOrder'>;
export type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  image: string;
  author: string;
  published: boolean;
  publishedAt: string | null;
};
export type BlogPostDraft = Omit<BlogPost, 'id' | 'publishedAt'>;
export type CatalogResourceDraft = Omit<StoreCollection, 'id' | 'productCount' | 'sortOrder'>;
export type StoreBrandDraft = Omit<StoreBrand, 'id' | 'productCount'>;

export class CategoryInUseError extends Error {}
export class CatalogResourceInUseError extends Error {}
export class LastAdminUserError extends Error {}

function decodeStringArray(value: string | string[]) {
  if (Array.isArray(value)) {
    return value;
  }

  const parsed: unknown = JSON.parse(value || '[]');
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('Stored product list data is invalid.');
  }

  return parsed;
}

function parseProductRow(row: ProductRow): Product {
  const savedPlacements = decodeStringArray(row.placements);
  const placements = savedPlacements.length > 0
    ? savedPlacements.filter((placement) => placement !== 'best_sellers')
    : [
        ...(Number(row.featured) === 1 ? ['featured'] : []),
        ...(Number(row.new_arrival) === 1 ? ['new_arrivals'] : []),
      ];

  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    originalPrice: row.original_price === null ? undefined : Number(row.original_price),
    rating: Number(row.rating),
    reviews: Number(row.reviews),
    badge: row.badge,
    image: normalizeProductImageUrl(row.image),
    shortDescription: row.short_description,
    description: row.description,
    ingredients: decodeStringArray(row.ingredients),
    benefits: decodeStringArray(row.benefits),
    sizes: decodeStringArray(row.sizes),
    stock: Number(row.stock),
    featured: Number(row.featured) === 1,
    newArrival: Number(row.new_arrival) === 1,
    placements,
    collection: row.collection,
    brand: row.brand || undefined,
    unitsSold: Number(row.units_sold ?? 0),
    viewCount: Number(row.view_count ?? 0),
    engagementSeconds: Number(row.engagement_seconds ?? 0),
  };
}

function productValues(product: ProductDraft) {
  return [
    product.slug,
    product.name,
    product.category,
    product.price,
    product.originalPrice ?? null,
    product.rating,
    product.reviews,
    product.badge,
    product.image,
    product.shortDescription,
    product.description,
    JSON.stringify(product.ingredients),
    JSON.stringify(product.benefits),
    JSON.stringify(product.sizes),
    product.stock,
    product.featured ? 1 : 0,
    product.newArrival ? 1 : 0,
    JSON.stringify(product.placements ?? []),
    product.collection,
    product.brand || null,
  ];
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function readCategories(): Promise<StoreCategory[]> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.readCategories();
  }

  const database = await getDatabase();
  const [rows] = await database.query<(RowDataPacket & StoreCategory)[]>(
    `SELECT categories.id, categories.name, categories.slug, categories.image,
      COUNT(products.id) AS productCount
     FROM categories
     LEFT JOIN products ON products.category = categories.name
     GROUP BY categories.id, categories.name, categories.slug, categories.image, categories.sort_order
     ORDER BY categories.sort_order, categories.name`,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    image: row.image,
    productCount: Number(row.productCount),
  }));
}

export async function getCategories(): Promise<StoreCategory[]> {
  return readCategories();
}

export async function categoryExists(name: string) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.categoryExists(name);
  }

  const database = await getDatabase();
  const [rows] = await database.execute<(RowDataPacket & { id: number })[]>(
    'SELECT id FROM categories WHERE name = ? LIMIT 1',
    [name],
  );
  return rows.length > 0;
}

export async function createCategory(name: string, slug: string, image: string) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.createCategory(name, slug, image);
  }

  const database = await getDatabase();
  const [result] = await database.execute<ResultSetHeader>(
    `INSERT INTO categories (name, slug, image, sort_order)
     SELECT ?, ?, ?, COALESCE(MAX(sort_order), -1) + 1 FROM categories`,
    [name, slug, image],
  );
  return { id: result.insertId, name, slug, image, productCount: 0 };
}

export async function updateCategory(id: number, name: string, slug: string, image: string) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.updateCategory(id, name, slug, image);
  }

  const database = await getDatabase();
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.execute<(RowDataPacket & { name: string })[]>(
      'SELECT name FROM categories WHERE id = ? FOR UPDATE',
      [id],
    );
    const existing = existingRows[0];
    if (!existing) {
      await connection.rollback();
      return null;
    }

    await connection.execute(
      'UPDATE categories SET name = ?, slug = ?, image = ? WHERE id = ?',
      [name, slug, image, id],
    );
    if (existing.name !== name) {
      await connection.execute(
        'UPDATE products SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE category = ?',
        [name, existing.name],
      );
    }
    const [countRows] = await connection.execute<(RowDataPacket & { productCount: number })[]>(
      'SELECT COUNT(*) AS productCount FROM products WHERE category = ?',
      [name],
    );
    await connection.commit();
    return { id, name, slug, image, productCount: Number(countRows[0]?.productCount ?? 0) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteCategory(id: number) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.deleteCategory(id);
  }

  const database = await getDatabase();
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<(RowDataPacket & { name: string })[]>(
      'SELECT name FROM categories WHERE id = ? FOR UPDATE',
      [id],
    );
    const category = rows[0];
    if (!category) {
      await connection.rollback();
      return false;
    }

    const [countRows] = await connection.execute<(RowDataPacket & { count: number })[]>(
      'SELECT COUNT(*) AS count FROM products WHERE category = ?',
      [category.name],
    );
    if (Number(countRows[0]?.count ?? 0) > 0) {
      await connection.rollback();
      throw new CategoryInUseError('Move or remove this category’s products before deleting it.');
    }

    await connection.execute('DELETE FROM categories WHERE id = ?', [id]);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function readCollections(): Promise<StoreCollection[]> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.readCollections();
  }
  const database = await getDatabase();
  const [rows] = await database.query<Array<RowDataPacket & StoreCollection>>(
    `SELECT collections.id, collections.name, collections.slug, collections.description, collections.image,
      collections.sort_order AS sortOrder, COUNT(products.id) AS productCount
     FROM collections LEFT JOIN products ON products.collection = collections.name
     GROUP BY collections.id ORDER BY collections.sort_order, collections.name`,
  );
  return rows.map((row) => ({
    id: Number(row.id), name: row.name, slug: row.slug, description: row.description,
    image: normalizeProductImageUrl(row.image), sortOrder: Number(row.sortOrder),
    productCount: Number(row.productCount),
  }));
}

export async function collectionExists(name: string) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return (await localStore.readCollections()).some((collection) => collection.name === name);
  }
  const database = await getDatabase();
  const [rows] = await database.execute<(RowDataPacket & { id: number })[]>(
    'SELECT id FROM collections WHERE name = ? LIMIT 1', [name],
  );
  return rows.length > 0;
}

export async function createCollection(draft: CatalogResourceDraft) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.createCollection(draft);
  }
  const database = await getDatabase();
  const [result] = await database.execute<ResultSetHeader>(
    `INSERT INTO collections (name, slug, description, image, sort_order)
     SELECT ?, ?, ?, ?, COALESCE(MAX(sort_order), -1) + 1 FROM collections`,
    [draft.name, draft.slug, draft.description, draft.image],
  );
  return { id: result.insertId, ...draft, sortOrder: 0, productCount: 0 };
}

export async function updateCollection(id: number, draft: CatalogResourceDraft) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.updateCollection(id, draft);
  }
  const database = await getDatabase();
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.execute<(RowDataPacket & { name: string })[]>(
      'SELECT name FROM collections WHERE id = ? FOR UPDATE', [id],
    );
    const existing = existingRows[0];
    if (!existing) {
      await connection.rollback();
      return null;
    }
    await connection.execute(
      'UPDATE collections SET name = ?, slug = ?, description = ?, image = ? WHERE id = ?',
      [draft.name, draft.slug, draft.description, draft.image, id],
    );
    if (existing.name !== draft.name) {
      await connection.execute('UPDATE products SET collection = ? WHERE collection = ?', [draft.name, existing.name]);
    }
    const [rows] = await connection.execute<(RowDataPacket & { sortOrder: number; productCount: number })[]>(
      `SELECT collections.sort_order AS sortOrder, COUNT(products.id) AS productCount
       FROM collections LEFT JOIN products ON products.collection = collections.name
       WHERE collections.id = ? GROUP BY collections.id`,
      [id],
    );
    await connection.commit();
    return { id, ...draft, sortOrder: Number(rows[0]?.sortOrder ?? 0), productCount: Number(rows[0]?.productCount ?? 0) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteCollection(id: number) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.deleteCollection(id);
  }
  const database = await getDatabase();
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<(RowDataPacket & { name: string })[]>(
      'SELECT name FROM collections WHERE id = ? FOR UPDATE', [id],
    );
    if (!rows[0]) {
      await connection.rollback();
      return false;
    }
    const [counts] = await connection.execute<(RowDataPacket & { count: number })[]>(
      'SELECT COUNT(*) AS count FROM products WHERE collection = ?', [rows[0].name],
    );
    if (Number(counts[0]?.count ?? 0) > 0) {
      await connection.rollback();
      throw new CatalogResourceInUseError('Move this collection’s products before deleting it.');
    }
    await connection.execute('DELETE FROM collections WHERE id = ?', [id]);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function readBrands(): Promise<StoreBrand[]> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.readBrands();
  }
  const database = await getDatabase();
  const [rows] = await database.query<Array<RowDataPacket & StoreBrand>>(
    `SELECT brands.id, brands.name, brands.slug, brands.description, brands.image,
      COUNT(products.id) AS productCount
     FROM brands LEFT JOIN products ON products.brand = brands.name
     GROUP BY brands.id ORDER BY brands.name`,
  );
  return rows.map((row) => ({
    id: Number(row.id), name: row.name, slug: row.slug, description: row.description,
    image: normalizeProductImageUrl(row.image), productCount: Number(row.productCount),
  }));
}

export async function brandExists(name: string) {
  if (!name) return true;
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return (await localStore.readBrands()).some((brand) => brand.name === name);
  }
  const database = await getDatabase();
  const [rows] = await database.execute<(RowDataPacket & { id: number })[]>(
    'SELECT id FROM brands WHERE name = ? LIMIT 1', [name],
  );
  return rows.length > 0;
}

export async function createBrand(draft: StoreBrandDraft) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.createBrand(draft);
  }
  const database = await getDatabase();
  const [result] = await database.execute<ResultSetHeader>(
    `INSERT INTO brands (name, slug, description, image, sort_order)
     SELECT ?, ?, ?, ?, COALESCE(MAX(sort_order), -1) + 1 FROM brands`,
    [draft.name, draft.slug, draft.description, draft.image],
  );
  return { id: result.insertId, ...draft, productCount: 0 };
}

export async function updateBrand(id: number, draft: StoreBrandDraft) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.updateBrand(id, draft);
  }
  const database = await getDatabase();
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.execute<(RowDataPacket & { name: string })[]>(
      'SELECT name FROM brands WHERE id = ? FOR UPDATE', [id],
    );
    const existing = existingRows[0];
    if (!existing) {
      await connection.rollback();
      return null;
    }
    await connection.execute('UPDATE brands SET name = ?, slug = ?, description = ?, image = ? WHERE id = ?', [
      draft.name, draft.slug, draft.description, draft.image, id,
    ]);
    if (existing.name !== draft.name) {
      await connection.execute('UPDATE products SET brand = ? WHERE brand = ?', [draft.name, existing.name]);
    }
    const [rows] = await connection.execute<(RowDataPacket & { productCount: number })[]>(
      'SELECT COUNT(*) AS productCount FROM products WHERE brand = ?', [draft.name],
    );
    await connection.commit();
    return { id, ...draft, productCount: Number(rows[0]?.productCount ?? 0) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteBrand(id: number) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.deleteBrand(id);
  }
  const database = await getDatabase();
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<(RowDataPacket & { name: string })[]>(
      'SELECT name FROM brands WHERE id = ? FOR UPDATE', [id],
    );
    if (!rows[0]) {
      await connection.rollback();
      return false;
    }
    const [counts] = await connection.execute<(RowDataPacket & { count: number })[]>(
      'SELECT COUNT(*) AS count FROM products WHERE brand = ?', [rows[0].name],
    );
    if (Number(counts[0]?.count ?? 0) > 0) {
      await connection.rollback();
      throw new CatalogResourceInUseError('Remove this brand from its products before deleting it.');
    }
    await connection.execute('DELETE FROM brands WHERE id = ?', [id]);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function readBlogPosts(includeDrafts = false): Promise<BlogPost[]> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.readBlogPosts(includeDrafts);
  }
  const database = await getDatabase();
  const [rows] = await database.query<Array<RowDataPacket & {
    id: number; slug: string; title: string; excerpt: string; content: string; category: string;
    image: string; author: string; published: number; published_at: Date | string | null;
  }>>(
    `SELECT id, slug, title, excerpt, content, category, image, author, published, published_at
     FROM blog_posts ${includeDrafts ? '' : 'WHERE published = 1'}
     ORDER BY COALESCE(published_at, created_at) DESC, id DESC`,
  );
  return rows.map((row) => ({
    id: Number(row.id), slug: row.slug, title: row.title, excerpt: row.excerpt, content: row.content,
    category: row.category, image: normalizeProductImageUrl(row.image), author: row.author,
    published: Number(row.published) === 1,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
  }));
}

export async function readBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const posts = await readBlogPosts();
  return posts.find((post) => post.slug === slug) ?? null;
}

export async function createBlogPost(post: BlogPostDraft) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.createBlogPost(post);
  }
  const database = await getDatabase();
  const [result] = await database.execute<ResultSetHeader>(
    `INSERT INTO blog_posts (slug, title, excerpt, content, category, image, author, published, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, IF(? = 1, UTC_TIMESTAMP(), NULL))`,
    [post.slug, post.title, post.excerpt, post.content, post.category, post.image, post.author,
      post.published ? 1 : 0, post.published ? 1 : 0],
  );
  return { id: result.insertId, ...post, publishedAt: post.published ? new Date().toISOString() : null };
}

export async function updateBlogPost(id: number, post: BlogPostDraft) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.updateBlogPost(id, post);
  }
  const database = await getDatabase();
  const [result] = await database.execute<ResultSetHeader>(
    `UPDATE blog_posts SET slug = ?, title = ?, excerpt = ?, content = ?, category = ?, image = ?,
      author = ?, published = ?, published_at = CASE
        WHEN ? = 0 THEN NULL WHEN published_at IS NULL THEN UTC_TIMESTAMP() ELSE published_at END
     WHERE id = ?`,
    [post.slug, post.title, post.excerpt, post.content, post.category, post.image, post.author,
      post.published ? 1 : 0, post.published ? 1 : 0, id],
  );
  return result.affectedRows > 0;
}

export async function deleteBlogPost(id: number) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.deleteBlogPost(id);
  }
  const database = await getDatabase();
  const [result] = await database.execute<ResultSetHeader>('DELETE FROM blog_posts WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await pbkdf2Async(password, salt, PASSWORD_ITERATIONS, 64, 'sha256')).toString('hex');
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.listAdminUsers();
  }
  const database = await getDatabase();
  const [rows] = await database.query<(RowDataPacket & AdminUser)[]>(
    'SELECT id, email, name, `role`, email_two_factor_enabled FROM users ORDER BY name, email',
  );
  return rows.map((row) => ({
    id: Number(row.id),
    email: row.email,
    name: row.name,
    role: row.role,
    emailTwoFactorEnabled: Number(row.email_two_factor_enabled) === 1,
  }));
}

export async function createAdminUser(
  email: string,
  name: string,
  password: string,
  emailTwoFactorEnabled = false,
): Promise<AdminUser> {
  const passwordHash = await hashPassword(password);
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.createAdminUser(email, name, passwordHash, emailTwoFactorEnabled);
  }
  const database = await getDatabase();
  const [result] = await database.execute<ResultSetHeader>(
    'INSERT INTO users (email, name, password_hash, password_salt, `role`, email_two_factor_enabled) VALUES (?, ?, ?, \'\', \'admin\', ?)',
    [email, name, passwordHash, emailTwoFactorEnabled ? 1 : 0],
  );
  return { id: result.insertId, email, name, role: 'admin', emailTwoFactorEnabled };
}

export async function deleteAdminUser(id: number) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.deleteAdminUser(id);
  }
  const database = await getDatabase();
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [userRows] = await connection.execute<(RowDataPacket & { role: string })[]>(
      'SELECT `role` FROM users WHERE id = ? FOR UPDATE', [id],
    );
    if (!userRows[0]) {
      await connection.rollback();
      return false;
    }
    if (userRows[0].role === 'admin') {
      const [adminRows] = await connection.execute<(RowDataPacket & { id: number })[]>(
        'SELECT id FROM users WHERE `role` = \'admin\' FOR UPDATE',
      );
      if (adminRows.length <= 1) {
        await connection.rollback();
        throw new LastAdminUserError('The last administrator account cannot be deleted.');
      }
    }
    await connection.execute('DELETE FROM users WHERE id = ?', [id]);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function verifyPassword(password: string, passwordHash: string, legacySalt: string) {
  const parts = passwordHash.split('$');
  let salt: string;
  let iterations: number;
  let expectedHash: string;
  let digest: 'sha256' | 'sha512';

  if (parts.length === 4 && parts[0] === 'pbkdf2-sha256') {
    iterations = Number(parts[1]);
    salt = parts[2];
    expectedHash = parts[3];
    digest = 'sha256';
  } else {
    iterations = 100_000;
    salt = legacySalt;
    expectedHash = passwordHash;
    digest = 'sha512';
  }

  if (
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    !salt ||
    !/^[a-f0-9]{128}$/i.test(expectedHash)
  ) {
    return false;
  }

  const candidate = await pbkdf2Async(password, salt, iterations, 64, digest);
  return timingSafeEqual(candidate, Buffer.from(expectedHash, 'hex'));
}

export async function authenticateUser(email: string, password: string): Promise<AdminUser | null> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.authenticateUser(email, password);
  }

  const database = await getDatabase();
  const [rows] = await database.execute<(UserRow & { email_two_factor_enabled: number })[]>(
    'SELECT id, email, name, `role`, password_hash, password_salt, email_two_factor_enabled FROM users WHERE email = ? LIMIT 1',
    [email.trim().toLowerCase()],
  );
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) {
    return null;
  }

  if (!user.password_hash.startsWith('pbkdf2-sha256$')) {
    await database.execute(
      'UPDATE users SET password_hash = ?, password_salt = \'\' WHERE id = ?',
      [await hashPassword(password), user.id],
    );
  }

  return {
    id: Number(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
    emailTwoFactorEnabled: Number(user.email_two_factor_enabled) === 1,
  };
}

export async function createAdminSession(userId: number) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.createAdminSession(userId);
  }

  const database = await getDatabase();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000);

  await database.execute('DELETE FROM admin_sessions WHERE expires_at <= UTC_TIMESTAMP()');
  await database.execute(
    'INSERT INTO admin_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [tokenHash, userId, expiresAt],
  );

  return { token, maxAge: SESSION_LIFETIME_SECONDS };
}

export async function refreshAdminSession(token: string): Promise<boolean> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.refreshAdminSession(token);
  }

  const database = await getDatabase();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const [result] = await database.execute<ResultSetHeader>(
    `UPDATE admin_sessions
     SET expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)
     WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP()`,
    [SESSION_LIFETIME_SECONDS, tokenHash],
  );
  return result.affectedRows > 0;
}

export async function createEmailTwoFactorChallenge(
  userId: number,
  challengeToken: string,
  codeHash: string,
) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.createEmailTwoFactorChallenge(userId, challengeToken, codeHash);
  }

  const database = await getDatabase();
  const challengeHash = createHash('sha256').update(challengeToken).digest('hex');
  await database.execute(
    'DELETE FROM admin_login_challenges WHERE user_id = ? OR expires_at <= UTC_TIMESTAMP()',
    [userId],
  );
  await database.execute(
    `INSERT INTO admin_login_challenges (challenge_hash, user_id, code_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))`,
    [challengeHash, userId, codeHash],
  );
}

export async function deleteEmailTwoFactorChallenge(challengeToken: string) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.deleteEmailTwoFactorChallenge(challengeToken);
  }

  const database = await getDatabase();
  const challengeHash = createHash('sha256').update(challengeToken).digest('hex');
  await database.execute('DELETE FROM admin_login_challenges WHERE challenge_hash = ?', [challengeHash]);
}

export async function verifyEmailTwoFactorChallenge(
  challengeToken: string,
  submittedCodeHash: string,
): Promise<AdminUser | null> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.verifyEmailTwoFactorChallenge(challengeToken, submittedCodeHash);
  }

  const database = await getDatabase();
  const connection = await database.getConnection();
  const challengeHash = createHash('sha256').update(challengeToken).digest('hex');
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<Array<RowDataPacket & {
      user_id: number;
      code_hash: string;
      attempts: number;
      id: number;
      email: string;
      name: string;
      role: string;
      email_two_factor_enabled: number;
    }>>(
      `SELECT challenges.user_id, challenges.code_hash, challenges.attempts,
        users.id, users.email, users.name, users.\`role\`, users.email_two_factor_enabled
       FROM admin_login_challenges AS challenges
       INNER JOIN users ON users.id = challenges.user_id
       WHERE challenges.challenge_hash = ? AND challenges.expires_at > UTC_TIMESTAMP()
       FOR UPDATE`,
      [challengeHash],
    );
    const challenge = rows[0];
    if (!challenge || Number(challenge.email_two_factor_enabled) !== 1) {
      await connection.rollback();
      return null;
    }

    const storedHash = Buffer.from(challenge.code_hash, 'hex');
    const submittedHash = Buffer.from(submittedCodeHash, 'hex');
    const matches = storedHash.length === submittedHash.length
      && timingSafeEqual(storedHash, submittedHash);
    if (!matches) {
      if (Number(challenge.attempts) >= 4) {
        await connection.execute('DELETE FROM admin_login_challenges WHERE challenge_hash = ?', [challengeHash]);
      } else {
        await connection.execute(
          'UPDATE admin_login_challenges SET attempts = attempts + 1 WHERE challenge_hash = ?',
          [challengeHash],
        );
      }
      await connection.commit();
      return null;
    }

    await connection.execute('DELETE FROM admin_login_challenges WHERE challenge_hash = ?', [challengeHash]);
    await connection.commit();
    return {
      id: Number(challenge.id),
      email: challenge.email,
      name: challenge.name,
      role: challenge.role,
      emailTwoFactorEnabled: true,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function readUserBySession(token: string): Promise<AdminUser | null> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.readUserBySession(token);
  }

  const database = await getDatabase();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const [rows] = await database.execute<(RowDataPacket & AdminUser)[]>(
    `    SELECT users.id, users.email, users.name, users.\`role\`
     FROM admin_sessions
     INNER JOIN users ON users.id = admin_sessions.user_id
     WHERE admin_sessions.token_hash = ? AND admin_sessions.expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [tokenHash],
  );

  return rows[0] ? {
    id: Number(rows[0].id),
    email: rows[0].email,
    name: rows[0].name,
    role: rows[0].role,
  } : null;
}

export async function deleteAdminSession(token: string) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.deleteAdminSession(token);
  }

  const database = await getDatabase();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await database.execute('DELETE FROM admin_sessions WHERE token_hash = ?', [tokenHash]);
}

export async function readProducts(): Promise<Product[]> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.readProducts();
  }

  const database = await getDatabase();
  const [rows] = await database.query<ProductRow[]>(`
    SELECT ${PRODUCT_COLUMNS},
      COALESCE((
        SELECT SUM(oi.quantity)
        FROM customer_order_items oi
        JOIN customer_orders co ON co.id = oi.order_id
        WHERE oi.product_id = products.id
          AND co.status <> 'cancelled'
          AND co.payment_status NOT IN ('failed', 'refunded')
          AND (co.payment_status = 'paid' OR co.status IN ('processing', 'shipped', 'delivered'))
      ), 0) AS units_sold,
      COALESCE((SELECT COUNT(*) FROM product_view_events pve WHERE pve.product_id = products.id), 0) AS view_count,
      COALESCE((SELECT SUM(duration_seconds) FROM product_view_events pve WHERE pve.product_id = products.id), 0) AS engagement_seconds
    FROM products ORDER BY id DESC
  `);
  return rows.map(parseProductRow);
}

export async function readProductById(id: number): Promise<Product | null> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.readProductById(id);
  }

  const database = await getDatabase();
  const [rows] = await database.execute<ProductRow[]>(
    `SELECT ${PRODUCT_COLUMNS},
      COALESCE((
        SELECT SUM(oi.quantity)
        FROM customer_order_items oi
        JOIN customer_orders co ON co.id = oi.order_id
        WHERE oi.product_id = products.id
          AND co.status <> 'cancelled'
          AND co.payment_status NOT IN ('failed', 'refunded')
          AND (co.payment_status = 'paid' OR co.status IN ('processing', 'shipped', 'delivered'))
      ), 0) AS units_sold,
      COALESCE((SELECT COUNT(*) FROM product_view_events pve WHERE pve.product_id = products.id), 0) AS view_count,
      COALESCE((SELECT SUM(duration_seconds) FROM product_view_events pve WHERE pve.product_id = products.id), 0) AS engagement_seconds
     FROM products WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? parseProductRow(rows[0]) : null;
}

export async function recordProductView(productId: number, eventHash: string, durationSeconds: number) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.recordProductView(productId, eventHash, durationSeconds);
  }

  const database = await getDatabase();
  await database.execute(
    `INSERT INTO product_view_events (event_hash, product_id, duration_seconds)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE duration_seconds = GREATEST(duration_seconds, ?)`,
    [eventHash, productId, durationSeconds, durationSeconds],
  );
}

export async function createProduct(product: ProductDraft): Promise<Product> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.createProduct(product);
  }

  const database = await getDatabase();
  const [result] = await database.execute<ResultSetHeader>(
    `INSERT INTO products (
      slug, name, category, price, original_price, rating, reviews, badge, image,
      short_description, description, ingredients, benefits, sizes, stock, featured,
      new_arrival, placements, collection, brand
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    productValues(product),
  );

  return { id: result.insertId, ...product };
}

export async function updateProduct(id: number, product: ProductDraft) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.updateProduct(id, product);
  }

  const database = await getDatabase();
  await database.execute(
    `UPDATE products SET
      slug = ?, name = ?, category = ?, price = ?, original_price = ?, rating = ?,
      reviews = ?, badge = ?, image = ?, short_description = ?, description = ?,
      ingredients = ?, benefits = ?, sizes = ?, stock = ?, featured = ?,
      new_arrival = ?, placements = ?, collection = ?, brand = ?
     WHERE id = ?`,
    [...productValues(product), id],
  );
}

export async function deleteProduct(id: number) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.deleteProduct(id);
  }

  const database = await getDatabase();
  const [result] = await database.execute<ResultSetHeader>('DELETE FROM products WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function getSiteContent(): Promise<Record<string, string>> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.getSiteContent();
  }

  const database = await getDatabase();
  const [rows] = await database.query<(RowDataPacket & { content_key: string; content_value: string })[]>(
    'SELECT content_key, content_value FROM site_content',
  );
  const content = { ...DEFAULT_SITE_CONTENT };

  for (const row of rows) {
    content[row.content_key] = row.content_value;
  }

  return content;
}

export async function saveSiteContent(payload: Record<string, string>) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/store-sqlite');
    return localStore.saveSiteContent(payload);
  }

  const database = await getDatabase();
  const entries = Object.entries(payload).filter(([key]) => Object.hasOwn(DEFAULT_SITE_CONTENT, key));
  if (entries.length === 0) {
    return;
  }

  const placeholders = entries.map(() => '(?, ?)').join(', ');
  const values = entries.flatMap(([key, value]) => [key, value]);
  await database.execute(
    `INSERT INTO site_content (content_key, content_value) VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE content_value = VALUES(content_value)`,
    values,
  );
}
