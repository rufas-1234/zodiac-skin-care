import { createHash, randomBytes, timingSafeEqual, pbkdf2 } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { categories as defaultCategories, defaultBlogPosts, defaultProducts, type Product } from '@/lib/data';
import { normalizeProductImageUrl } from '@/lib/product-images';
import { SESSION_IDLE_TIMEOUT_SECONDS } from '@/lib/auth-constants';
import type {
  AdminUser,
  BlogPost,
  BlogPostDraft,
  CatalogResourceDraft,
  ProductDraft,
  StoreBrand,
  StoreBrandDraft,
  StoreCategory,
  StoreCollection,
} from '@/lib/store';
import { DEFAULT_SITE_CONTENT } from '@/lib/site-content';

const pbkdf2Async = promisify(pbkdf2);
const databasePath = path.join(process.cwd(), 'data', 'zodiac.db');
const sessionLifetimeSeconds = SESSION_IDLE_TIMEOUT_SECONDS;
type ProductRow = Record<string, unknown> & { id: number };
type UserRow = Record<string, unknown> & { id: number };

function openDatabase() {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'admin',
      email_two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT NOT NULL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS admin_login_challenges (
      challenge_hash TEXT NOT NULL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      image TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Beauty',
      image TEXT NOT NULL,
      author TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      original_price REAL,
      rating REAL NOT NULL DEFAULT 4.8,
      reviews INTEGER NOT NULL DEFAULT 0,
      badge TEXT NOT NULL DEFAULT 'New',
      image TEXT NOT NULL,
      short_description TEXT NOT NULL,
      description TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      benefits TEXT NOT NULL,
      sizes TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      new_arrival INTEGER NOT NULL DEFAULT 0,
      placements TEXT NOT NULL DEFAULT '[]',
      collection TEXT NOT NULL DEFAULT 'Glow Ritual',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS product_view_events (
      event_hash TEXT NOT NULL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS product_view_events_product_idx ON product_view_events(product_id);
    CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  if (!userColumns.some((column) => column.name === 'email_two_factor_enabled')) {
    db.exec('ALTER TABLE users ADD COLUMN email_two_factor_enabled INTEGER NOT NULL DEFAULT 0');
  }

  const productColumns = db.prepare('PRAGMA table_info(products)').all() as Array<{ name: string }>;
  if (!productColumns.some((column) => column.name === 'brand')) {
    db.exec('ALTER TABLE products ADD COLUMN brand TEXT');
  }
  if (!productColumns.some((column) => column.name === 'placements')) {
    db.exec("ALTER TABLE products ADD COLUMN placements TEXT NOT NULL DEFAULT '[]'");
    db.exec("UPDATE products SET placements = json_insert(placements, '$[#]', 'featured') WHERE featured = 1");
    db.exec("UPDATE products SET placements = json_insert(placements, '$[#]', 'new_arrivals') WHERE new_arrival = 1");
  }

  const placementRows = db.prepare(
    'SELECT id, placements, featured, new_arrival FROM products',
  ).all() as Array<{ id: number; placements: string; featured: number; new_arrival: number }>;
  const updatePlacements = db.prepare('UPDATE products SET placements = ? WHERE id = ?');
  for (const row of placementRows) {
    const stored: unknown = JSON.parse(row.placements || '[]');
    if (!Array.isArray(stored)) {
      throw new Error(`Product ${row.id} has invalid stored placements.`);
    }

    const placements = new Set(stored.filter((placement): placement is string => typeof placement === 'string'));
    placements.delete('best_sellers');
    if (placements.size === 0) {
      if (row.featured === 1) {
        placements.add('featured');
      }
      if (row.new_arrival === 1) {
        placements.add('new_arrivals');
      }
    }
    const normalized = JSON.stringify([...placements]);
    if (normalized !== row.placements) {
      updatePlacements.run(normalized, row.id);
    }
  }

  const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number };
  if (Number(productCount.count) === 0) {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO products (
        slug, name, category, price, original_price, rating, reviews, badge, image,
        short_description, description, ingredients, benefits, sizes, stock, featured,
        new_arrival, placements, collection
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const product of defaultProducts) {
      insert.run(
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
        JSON.stringify(product.placements ?? [
          ...(product.featured ? ['featured'] : []),
          ...(product.newArrival ? ['new_arrivals'] : []),
        ]),
        product.collection,
      );
    }
  }

  const insertContent = db.prepare(
    'INSERT OR IGNORE INTO site_content (key, value) VALUES (?, ?)',
  );
  for (const [key, value] of Object.entries(DEFAULT_SITE_CONTENT)) {
    insertContent.run(key, value);
  }

  const categorySeeded = db.prepare(
    'SELECT setting_value FROM app_settings WHERE setting_key = ?',
  ).get('default_categories_seeded');
  if (!categorySeeded) {
    const insertCategory = db.prepare(
      'INSERT OR IGNORE INTO categories (name, slug, image, sort_order) VALUES (?, ?, ?, ?)',
    );
    for (const [index, category] of defaultCategories.entries()) {
      insertCategory.run(
        category.name,
        category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        category.image,
        index,
      );
    }
    db.prepare('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)').run(
      'default_categories_seeded',
      '1',
    );
  }

  const collectionRows = db.prepare(
    'SELECT collection AS name, MIN(image) AS image FROM products WHERE collection <> \'\' GROUP BY collection ORDER BY collection',
  ).all() as Array<{ name: string; image: string }>;
  const insertCollection = db.prepare(
    'INSERT OR IGNORE INTO collections (name, slug, description, image, sort_order) VALUES (?, ?, ?, ?, ?)',
  );
  for (const [index, collection] of collectionRows.entries()) {
    const slug = collection.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (slug) {
      insertCollection.run(collection.name, slug, `${collection.name} collection`, collection.image, index);
    }
  }

  const blogSeeded = db.prepare(
    'SELECT setting_value FROM app_settings WHERE setting_key = ?',
  ).get('default_blog_seeded');
  if (!blogSeeded) {
    const insertPost = db.prepare(`
      INSERT OR IGNORE INTO blog_posts
        (slug, title, excerpt, content, category, image, author, published, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `);
    for (const post of defaultBlogPosts) {
      insertPost.run(post.slug, post.title, post.excerpt, post.content, post.category, post.image, post.author);
    }
    db.prepare('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)').run(
      'default_blog_seeded',
      '1',
    );
  }

  return db;
}

function parseProduct(row: ProductRow): Product {
  const savedPlacements = JSON.parse(String(row.placements || '[]')) as string[];
  const placements = savedPlacements.length > 0
    ? savedPlacements.filter((placement) => placement !== 'best_sellers')
    : [
        ...(Number(row.featured) === 1 ? ['featured'] : []),
        ...(Number(row.new_arrival) === 1 ? ['new_arrivals'] : []),
      ];

  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    category: String(row.category) as Product['category'],
    price: Number(row.price),
    originalPrice: row.original_price === null ? undefined : Number(row.original_price),
    rating: Number(row.rating),
    reviews: Number(row.reviews),
    badge: String(row.badge),
    image: normalizeProductImageUrl(String(row.image)),
    shortDescription: String(row.short_description),
    description: String(row.description),
    ingredients: JSON.parse(String(row.ingredients || '[]')) as string[],
    benefits: JSON.parse(String(row.benefits || '[]')) as string[],
    sizes: JSON.parse(String(row.sizes || '[]')) as string[],
    stock: Number(row.stock),
    featured: Number(row.featured) === 1,
    newArrival: Number(row.new_arrival) === 1,
    placements,
    collection: String(row.collection),
    brand: row.brand === null || row.brand === undefined ? undefined : String(row.brand),
    unitsSold: Number(row.units_sold ?? 0),
    viewCount: Number(row.view_count ?? 0),
    engagementSeconds: Number(row.engagement_seconds ?? 0),
  };
}

function insertProduct(db: DatabaseSync, product: ProductDraft) {
  return db.prepare(`
    INSERT INTO products (
      slug, name, category, price, original_price, rating, reviews, badge, image,
      short_description, description, ingredients, benefits, sizes, stock, featured,
      new_arrival, placements, collection, brand
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
  );
}

export async function readCategories(): Promise<StoreCategory[]> {
  const db = openDatabase();
  try {
    return db.prepare(`
      SELECT categories.id, categories.name, categories.slug, categories.image,
        COUNT(products.id) AS productCount
      FROM categories
      LEFT JOIN products ON products.category = categories.name
      GROUP BY categories.id
      ORDER BY categories.sort_order, categories.name
    `).all().map((row) => {
      const category = row as Record<string, unknown>;
      return {
        id: Number(category.id),
        name: String(category.name),
        slug: String(category.slug),
        image: String(category.image),
        productCount: Number(category.productCount),
      };
    });
  } finally {
    db.close();
  }
}

export async function categoryExists(name: string) {
  const db = openDatabase();
  try {
    return Boolean(db.prepare('SELECT id FROM categories WHERE name = ? LIMIT 1').get(name));
  } finally {
    db.close();
  }
}

export async function createCategory(name: string, slug: string, image: string) {
  const db = openDatabase();
  try {
    const result = db.prepare(`
      INSERT INTO categories (name, slug, image, sort_order)
      VALUES (?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM categories), 0))
    `).run(name, slug, image);
    return { id: Number(result.lastInsertRowid), name, slug, image, productCount: 0 };
  } finally {
    db.close();
  }
}

export async function updateCategory(id: number, name: string, slug: string, image: string) {
  const db = openDatabase();
  try {
    db.exec('BEGIN IMMEDIATE');
    const existing = db.prepare('SELECT name FROM categories WHERE id = ?').get(id) as { name: string } | undefined;
    if (!existing) {
      db.exec('ROLLBACK');
      return null;
    }

    db.prepare(`
      UPDATE categories SET name = ?, slug = ?, image = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, slug, image, id);
    if (existing.name !== name) {
      db.prepare(`
        UPDATE products SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE category = ?
      `).run(name, existing.name);
    }
    const count = db.prepare('SELECT COUNT(*) AS count FROM products WHERE category = ?').get(name) as { count: number };
    db.exec('COMMIT');
    return { id, name, slug, image, productCount: Number(count.count) };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

export async function deleteCategory(id: number) {
  const db = openDatabase();
  try {
    db.exec('BEGIN IMMEDIATE');
    const category = db.prepare('SELECT name FROM categories WHERE id = ?').get(id) as { name: string } | undefined;
    if (!category) {
      db.exec('ROLLBACK');
      return false;
    }

    const count = db.prepare('SELECT COUNT(*) AS count FROM products WHERE category = ?')
      .get(category.name) as { count: number };
    if (Number(count.count) > 0) {
      db.exec('ROLLBACK');
      const { CategoryInUseError } = await import('@/lib/store');
      throw new CategoryInUseError('Move or remove this category’s products before deleting it.');
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    db.exec('COMMIT');
    return true;
  } catch (error) {
    if (db.isTransaction) {
      db.exec('ROLLBACK');
    }
    throw error;
  } finally {
    db.close();
  }
}

export async function readCollections(): Promise<StoreCollection[]> {
  const db = openDatabase();
  try {
    return (db.prepare(`
      SELECT collections.id, collections.name, collections.slug, collections.description,
        collections.image, collections.sort_order AS sortOrder, COUNT(products.id) AS productCount
      FROM collections
      LEFT JOIN products ON products.collection = collections.name
      GROUP BY collections.id
      ORDER BY collections.sort_order, collections.name
    `).all() as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      slug: String(row.slug),
      description: String(row.description),
      image: normalizeProductImageUrl(String(row.image)),
      sortOrder: Number(row.sortOrder),
      productCount: Number(row.productCount),
    }));
  } finally {
    db.close();
  }
}

export async function createCollection(draft: CatalogResourceDraft) {
  const db = openDatabase();
  try {
    const result = db.prepare(`
      INSERT INTO collections (name, slug, description, image, sort_order)
      VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM collections), 0))
    `).run(draft.name, draft.slug, draft.description, draft.image);
    return { id: Number(result.lastInsertRowid), ...draft, sortOrder: 0, productCount: 0 };
  } finally {
    db.close();
  }
}

export async function updateCollection(id: number, draft: CatalogResourceDraft) {
  const db = openDatabase();
  try {
    db.exec('BEGIN IMMEDIATE');
    const existing = db.prepare('SELECT name FROM collections WHERE id = ?').get(id) as { name: string } | undefined;
    if (!existing) {
      db.exec('ROLLBACK');
      return null;
    }
    db.prepare(`
      UPDATE collections SET name = ?, slug = ?, description = ?, image = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(draft.name, draft.slug, draft.description, draft.image, id);
    if (existing.name !== draft.name) {
      db.prepare('UPDATE products SET collection = ?, updated_at = CURRENT_TIMESTAMP WHERE collection = ?')
        .run(draft.name, existing.name);
    }
    const row = db.prepare('SELECT sort_order FROM collections WHERE id = ?').get(id) as { sort_order: number };
    const count = db.prepare('SELECT COUNT(*) AS count FROM products WHERE collection = ?').get(draft.name) as { count: number };
    db.exec('COMMIT');
    return { id, ...draft, sortOrder: Number(row.sort_order), productCount: Number(count.count) };
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

export async function deleteCollection(id: number) {
  const db = openDatabase();
  try {
    db.exec('BEGIN IMMEDIATE');
    const collection = db.prepare('SELECT name FROM collections WHERE id = ?').get(id) as { name: string } | undefined;
    if (!collection) {
      db.exec('ROLLBACK');
      return false;
    }
    const count = db.prepare('SELECT COUNT(*) AS count FROM products WHERE collection = ?').get(collection.name) as { count: number };
    if (Number(count.count) > 0) {
      db.exec('ROLLBACK');
      const { CatalogResourceInUseError } = await import('@/lib/store');
      throw new CatalogResourceInUseError('Move this collection’s products before deleting it.');
    }
    db.prepare('DELETE FROM collections WHERE id = ?').run(id);
    db.exec('COMMIT');
    return true;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

export async function readBrands(): Promise<StoreBrand[]> {
  const db = openDatabase();
  try {
    return (db.prepare(`
      SELECT brands.id, brands.name, brands.slug, brands.description, brands.image,
        COUNT(products.id) AS productCount
      FROM brands
      LEFT JOIN products ON products.brand = brands.name
      GROUP BY brands.id
      ORDER BY brands.name
    `).all() as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      slug: String(row.slug),
      description: String(row.description),
      image: normalizeProductImageUrl(String(row.image)),
      productCount: Number(row.productCount),
    }));
  } finally {
    db.close();
  }
}

export async function createBrand(draft: StoreBrandDraft) {
  const db = openDatabase();
  try {
    const result = db.prepare(`
      INSERT INTO brands (name, slug, description, image, sort_order)
      VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM brands), 0))
    `).run(draft.name, draft.slug, draft.description, draft.image);
    return { id: Number(result.lastInsertRowid), ...draft, productCount: 0 };
  } finally {
    db.close();
  }
}

export async function updateBrand(id: number, draft: StoreBrandDraft) {
  const db = openDatabase();
  try {
    db.exec('BEGIN IMMEDIATE');
    const existing = db.prepare('SELECT name FROM brands WHERE id = ?').get(id) as { name: string } | undefined;
    if (!existing) {
      db.exec('ROLLBACK');
      return null;
    }
    db.prepare(`
      UPDATE brands SET name = ?, slug = ?, description = ?, image = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(draft.name, draft.slug, draft.description, draft.image, id);
    if (existing.name !== draft.name) {
      db.prepare('UPDATE products SET brand = ?, updated_at = CURRENT_TIMESTAMP WHERE brand = ?')
        .run(draft.name, existing.name);
    }
    const count = db.prepare('SELECT COUNT(*) AS count FROM products WHERE brand = ?').get(draft.name) as { count: number };
    db.exec('COMMIT');
    return { id, ...draft, productCount: Number(count.count) };
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

export async function deleteBrand(id: number) {
  const db = openDatabase();
  try {
    db.exec('BEGIN IMMEDIATE');
    const brand = db.prepare('SELECT name FROM brands WHERE id = ?').get(id) as { name: string } | undefined;
    if (!brand) {
      db.exec('ROLLBACK');
      return false;
    }
    const count = db.prepare('SELECT COUNT(*) AS count FROM products WHERE brand = ?').get(brand.name) as { count: number };
    if (Number(count.count) > 0) {
      db.exec('ROLLBACK');
      const { CatalogResourceInUseError } = await import('@/lib/store');
      throw new CatalogResourceInUseError('Remove this brand from its products before deleting it.');
    }
    db.prepare('DELETE FROM brands WHERE id = ?').run(id);
    db.exec('COMMIT');
    return true;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

export async function readBlogPosts(includeDrafts = false): Promise<BlogPost[]> {
  const db = openDatabase();
  try {
    const rows = db.prepare(`
      SELECT id, slug, title, excerpt, content, category, image, author, published, published_at AS publishedAt
      FROM blog_posts
      ${includeDrafts ? '' : 'WHERE published = 1'}
      ORDER BY COALESCE(published_at, created_at) DESC, id DESC
    `).all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: Number(row.id),
      slug: String(row.slug),
      title: String(row.title),
      excerpt: String(row.excerpt),
      content: String(row.content),
      category: String(row.category),
      image: normalizeProductImageUrl(String(row.image)),
      author: String(row.author),
      published: Number(row.published) === 1,
      publishedAt: row.publishedAt ? String(row.publishedAt) : null,
    }));
  } finally {
    db.close();
  }
}

export async function createBlogPost(post: BlogPostDraft) {
  const db = openDatabase();
  try {
    const result = db.prepare(`
      INSERT INTO blog_posts (slug, title, excerpt, content, category, image, author, published, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
    `).run(
      post.slug, post.title, post.excerpt, post.content, post.category, post.image, post.author,
      post.published ? 1 : 0, post.published ? 1 : 0,
    );
    return { id: Number(result.lastInsertRowid), ...post, publishedAt: post.published ? new Date().toISOString() : null };
  } finally {
    db.close();
  }
}

export async function updateBlogPost(id: number, post: BlogPostDraft) {
  const db = openDatabase();
  try {
    const result = db.prepare(`
      UPDATE blog_posts SET slug = ?, title = ?, excerpt = ?, content = ?, category = ?, image = ?,
        author = ?, published = ?, published_at = CASE
          WHEN ? = 0 THEN NULL
          WHEN published_at IS NULL THEN CURRENT_TIMESTAMP
          ELSE published_at
        END, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      post.slug, post.title, post.excerpt, post.content, post.category, post.image, post.author,
      post.published ? 1 : 0, post.published ? 1 : 0, id,
    );
    return result.changes > 0;
  } finally {
    db.close();
  }
}

export async function deleteBlogPost(id: number) {
  const db = openDatabase();
  try {
    return db.prepare('DELETE FROM blog_posts WHERE id = ?').run(id).changes > 0;
  } finally {
    db.close();
  }
}

export async function listAdminUsers() {
  const db = openDatabase();
  try {
    const users = db.prepare(
      'SELECT id, email, name, role, email_two_factor_enabled FROM users ORDER BY name, email',
    ).all() as Array<UserRow & { email: string; name: string; role: string; email_two_factor_enabled: number }>;
    return users.map((user) => ({
      id: Number(user.id),
      email: user.email,
      name: user.name,
      role: user.role,
      emailTwoFactorEnabled: Number(user.email_two_factor_enabled) === 1,
    }));
  } finally {
    db.close();
  }
}

export async function createAdminUser(email: string, name: string, passwordHash: string, emailTwoFactorEnabled = false) {
  const db = openDatabase();
  try {
    const result = db.prepare(
      'INSERT INTO users (email, name, password_hash, password_salt, role, email_two_factor_enabled) VALUES (?, ?, ?, \'\', \'admin\', ?)',
    ).run(email, name, passwordHash, emailTwoFactorEnabled ? 1 : 0);
    return {
      id: Number(result.lastInsertRowid),
      email,
      name,
      role: 'admin',
      emailTwoFactorEnabled,
    };
  } finally {
    db.close();
  }
}

export async function deleteAdminUser(id: number) {
  const db = openDatabase();
  try {
    db.exec('BEGIN IMMEDIATE');
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined;
    if (!user) {
      db.exec('ROLLBACK');
      return false;
    }
    const adminCount = db.prepare('SELECT COUNT(*) AS count FROM users WHERE role = \'admin\'').get() as { count: number };
    if (user.role === 'admin' && Number(adminCount.count) <= 1) {
      db.exec('ROLLBACK');
      const { LastAdminUserError } = await import('@/lib/store');
      throw new LastAdminUserError('The last administrator account cannot be deleted.');
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    db.exec('COMMIT');
    return true;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

export async function authenticateUser(email: string, password: string): Promise<AdminUser | null> {
  const db = openDatabase();
  try {
    const user = db.prepare(
      'SELECT id, email, name, role, password_hash, password_salt, email_two_factor_enabled FROM users WHERE email = ? LIMIT 1',
    ).get(email.trim().toLowerCase()) as UserRow | undefined;
    if (!user) {
      return null;
    }

    const hash = String(user.password_hash);
    const parts = hash.split('$');
    const isCurrentHash = parts.length === 4 && parts[0] === 'pbkdf2-sha256';
    const iterations = isCurrentHash ? Number(parts[1]) : 100_000;
    const salt = isCurrentHash ? parts[2] : String(user.password_salt);
    const expectedHash = isCurrentHash ? parts[3] : hash;
    const digest = isCurrentHash ? 'sha256' : 'sha512';

    if (!Number.isInteger(iterations) || !salt || !/^[a-f0-9]{128}$/i.test(expectedHash)) {
      return null;
    }
    const candidate = await pbkdf2Async(password, salt, iterations, 64, digest);
    if (!timingSafeEqual(candidate, Buffer.from(expectedHash, 'hex'))) {
      return null;
    }

    if (!isCurrentHash) {
      const newSalt = randomBytes(16).toString('hex');
      const newHash = (await pbkdf2Async(password, newSalt, 600_000, 64, 'sha256')).toString('hex');
      db.prepare('UPDATE users SET password_hash = ?, password_salt = \'\' WHERE id = ?')
        .run(`pbkdf2-sha256$600000$${newSalt}$${newHash}`, Number(user.id));
    }

    return {
      id: Number(user.id),
      email: String(user.email),
      name: String(user.name),
      role: String(user.role),
      emailTwoFactorEnabled: Number(user.email_two_factor_enabled) === 1,
    };
  } finally {
    db.close();
  }
}

export async function createAdminSession(userId: number) {
  const db = openDatabase();
  try {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000).toISOString();
    db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(new Date().toISOString());
    db.prepare('INSERT INTO admin_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(tokenHash, userId, expiresAt);
    return { token, maxAge: sessionLifetimeSeconds };
  } finally {
    db.close();
  }
}

export async function readUserBySession(token: string): Promise<AdminUser | null> {
  const db = openDatabase();
  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = db.prepare(`
      SELECT users.id, users.email, users.name, users.role
      FROM admin_sessions
      INNER JOIN users ON users.id = admin_sessions.user_id
      WHERE admin_sessions.token_hash = ? AND admin_sessions.expires_at > ?
      LIMIT 1
    `).get(tokenHash, new Date().toISOString()) as UserRow | undefined;
    return row ? {
      id: Number(row.id),
      email: String(row.email),
      name: String(row.name),
      role: String(row.role),
    } : null;
  } finally {
    db.close();
  }
}

export async function refreshAdminSession(token: string): Promise<boolean> {
  const db = openDatabase();
  try {
    const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000).toISOString();
    const result = db.prepare(
      'UPDATE admin_sessions SET expires_at = ? WHERE token_hash = ? AND expires_at > ?',
    ).run(expiresAt, createHash('sha256').update(token).digest('hex'), new Date().toISOString());
    return result.changes > 0;
  } finally {
    db.close();
  }
}

export async function createEmailTwoFactorChallenge(userId: number, challengeToken: string, codeHash: string) {
  const db = openDatabase();
  try {
    db.prepare('DELETE FROM admin_login_challenges WHERE user_id = ? OR expires_at <= ?')
      .run(userId, new Date().toISOString());
    db.prepare(
      'INSERT INTO admin_login_challenges (challenge_hash, user_id, code_hash, expires_at) VALUES (?, ?, ?, ?)',
    ).run(
      createHash('sha256').update(challengeToken).digest('hex'),
      userId,
      codeHash,
      new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    );
  } finally {
    db.close();
  }
}

export async function deleteEmailTwoFactorChallenge(challengeToken: string) {
  const db = openDatabase();
  try {
    db.prepare('DELETE FROM admin_login_challenges WHERE challenge_hash = ?')
      .run(createHash('sha256').update(challengeToken).digest('hex'));
  } finally {
    db.close();
  }
}

export async function verifyEmailTwoFactorChallenge(
  challengeToken: string,
  submittedCodeHash: string,
): Promise<AdminUser | null> {
  const db = openDatabase();
  const challengeHash = createHash('sha256').update(challengeToken).digest('hex');
  try {
    db.exec('BEGIN IMMEDIATE');
    const row = db.prepare(`
      SELECT challenges.user_id, challenges.code_hash, challenges.attempts,
        users.id, users.email, users.name, users.role, users.email_two_factor_enabled
      FROM admin_login_challenges AS challenges
      INNER JOIN users ON users.id = challenges.user_id
      WHERE challenges.challenge_hash = ? AND challenges.expires_at > ?
      LIMIT 1
    `).get(challengeHash, new Date().toISOString()) as (UserRow & {
      code_hash: string;
      attempts: number;
      email: string;
      name: string;
      role: string;
      email_two_factor_enabled: number;
    }) | undefined;
    if (!row || Number(row.email_two_factor_enabled) !== 1) {
      db.exec('ROLLBACK');
      return null;
    }

    const storedHash = Buffer.from(row.code_hash, 'hex');
    const submittedHash = Buffer.from(submittedCodeHash, 'hex');
    const matches = storedHash.length === submittedHash.length
      && timingSafeEqual(storedHash, submittedHash);
    if (!matches) {
      if (Number(row.attempts) >= 4) {
        db.prepare('DELETE FROM admin_login_challenges WHERE challenge_hash = ?').run(challengeHash);
      } else {
        db.prepare('UPDATE admin_login_challenges SET attempts = attempts + 1 WHERE challenge_hash = ?')
          .run(challengeHash);
      }
      db.exec('COMMIT');
      return null;
    }

    db.prepare('DELETE FROM admin_login_challenges WHERE challenge_hash = ?').run(challengeHash);
    db.exec('COMMIT');
    return {
      id: Number(row.id),
      email: row.email,
      name: row.name,
      role: row.role,
      emailTwoFactorEnabled: true,
    };
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

export async function deleteAdminSession(token: string) {
  const db = openDatabase();
  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
  } finally {
    db.close();
  }
}

export async function readProducts() {
  const db = openDatabase();
  try {
    const hasOrders = Boolean(db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'customer_orders'",
    ).get()) && Boolean(db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'customer_order_items'",
    ).get());
    const sales = hasOrders
      ? `COALESCE((
          SELECT SUM(oi.quantity)
          FROM customer_order_items oi
          JOIN customer_orders co ON co.id = oi.order_id
          WHERE oi.product_id = products.id
            AND co.status <> 'cancelled'
            AND co.payment_status NOT IN ('failed', 'refunded')
            AND (co.payment_status = 'paid' OR co.status IN ('processing', 'shipped', 'delivered'))
        ), 0)`
      : '0';
    const rows = db.prepare(`
      SELECT products.*,
        ${sales} AS units_sold,
        (SELECT COUNT(*) FROM product_view_events pve WHERE pve.product_id = products.id) AS view_count,
        COALESCE((SELECT SUM(duration_seconds) FROM product_view_events pve WHERE pve.product_id = products.id), 0) AS engagement_seconds
      FROM products ORDER BY id DESC
    `).all() as ProductRow[];
    return rows.map(parseProduct);
  } finally {
    db.close();
  }
}

export async function readProductById(id: number) {
  const db = openDatabase();
  try {
    const hasOrders = Boolean(db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'customer_orders'",
    ).get()) && Boolean(db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'customer_order_items'",
    ).get());
    const sales = hasOrders
      ? `COALESCE((
          SELECT SUM(oi.quantity)
          FROM customer_order_items oi
          JOIN customer_orders co ON co.id = oi.order_id
          WHERE oi.product_id = products.id
            AND co.status <> 'cancelled'
            AND co.payment_status NOT IN ('failed', 'refunded')
            AND (co.payment_status = 'paid' OR co.status IN ('processing', 'shipped', 'delivered'))
        ), 0)`
      : '0';
    const row = db.prepare(`
      SELECT products.*,
        ${sales} AS units_sold,
        (SELECT COUNT(*) FROM product_view_events pve WHERE pve.product_id = products.id) AS view_count,
        COALESCE((SELECT SUM(duration_seconds) FROM product_view_events pve WHERE pve.product_id = products.id), 0) AS engagement_seconds
      FROM products WHERE id = ? LIMIT 1
    `).get(id) as ProductRow | undefined;
    return row ? parseProduct(row) : null;
  } finally {
    db.close();
  }
}

export async function recordProductView(productId: number, eventHash: string, durationSeconds: number) {
  const db = openDatabase();
  try {
    db.prepare(`
      INSERT INTO product_view_events (event_hash, product_id, duration_seconds)
      VALUES (?, ?, ?)
      ON CONFLICT(event_hash) DO UPDATE SET
        duration_seconds = MAX(product_view_events.duration_seconds, excluded.duration_seconds)
    `).run(eventHash, productId, durationSeconds);
  } finally {
    db.close();
  }
}

export async function createProduct(product: ProductDraft) {
  const db = openDatabase();
  try {
    const result = insertProduct(db, product);
    return { id: Number(result.lastInsertRowid), ...product };
  } finally {
    db.close();
  }
}

export async function updateProduct(id: number, product: ProductDraft) {
  const db = openDatabase();
  try {
    db.prepare(`
      UPDATE products SET
        slug = ?, name = ?, category = ?, price = ?, original_price = ?, rating = ?,
        reviews = ?, badge = ?, image = ?, short_description = ?, description = ?,
        ingredients = ?, benefits = ?, sizes = ?, stock = ?, featured = ?,
        new_arrival = ?, placements = ?, collection = ?, brand = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
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
      id,
    );
  } finally {
    db.close();
  }
}

export async function deleteProduct(id: number) {
  const db = openDatabase();
  try {
    return db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0;
  } finally {
    db.close();
  }
}

export async function getSiteContent() {
  const db = openDatabase();
  try {
    const content = { ...DEFAULT_SITE_CONTENT };
    const rows = db.prepare('SELECT key, value FROM site_content').all() as Array<{ key: string; value: string }>;
    for (const row of rows) {
      content[row.key] = row.value;
    }
    return content;
  } finally {
    db.close();
  }
}

export async function saveSiteContent(payload: Record<string, string>) {
  const db = openDatabase();
  try {
    const statement = db.prepare(`
      INSERT INTO site_content (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    for (const [key, value] of Object.entries(payload)) {
      statement.run(key, value);
    }
  } finally {
    db.close();
  }
}
