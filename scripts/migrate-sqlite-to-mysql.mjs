import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const sourcePath = path.join(process.cwd(), 'data', 'zodiac.db');
const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');

if (!process.env.MYSQL_HOST || !process.env.MYSQL_DATABASE || !process.env.MYSQL_USER || !process.env.MYSQL_PASSWORD) {
  throw new Error('Set MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, and MYSQL_PASSWORD before migrating.');
}

const sqlite = new DatabaseSync(sourcePath);
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 2,
  charset: 'utf8mb4',
  timezone: 'Z',
  ssl: {
    minVersion: 'TLSv1.2',
  },
});

function jsonValue(value) {
  return JSON.stringify(JSON.parse(value || '[]'));
}

function productPlacements(product) {
  const saved = product.placements ? JSON.parse(product.placements) : [];
  if (!Array.isArray(saved)) {
    throw new Error(`Product ${product.id} has invalid stored placements.`);
  }
  const placements = new Set(saved.filter((placement) => typeof placement === 'string'));
  placements.delete('best_sellers');
  if (placements.size === 0) {
    if (product.featured) {
      placements.add('featured');
    }
    if (product.new_arrival) {
      placements.add('new_arrivals');
    }
  }
  return JSON.stringify([...placements]);
}

function hasSqliteTable(name) {
  return Boolean(sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(name));
}

try {
  const schema = await readFile(schemaPath, 'utf8');
  for (const statement of schema.split(';').map((part) => part.trim()).filter(Boolean)) {
    await pool.query(statement);
  }

  const [brandColumns] = await pool.query(`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'brand'
  `);
  if (brandColumns.length === 0) {
    await pool.query('ALTER TABLE products ADD COLUMN brand VARCHAR(120) NULL AFTER collection');
  }

  const [targetRows] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM products) AS products,
      (SELECT COUNT(*) FROM categories) AS categories,
      (SELECT COUNT(*) FROM collections) AS collections,
      (SELECT COUNT(*) FROM brands) AS brands,
      (SELECT COUNT(*) FROM blog_posts) AS blog_posts,
      (SELECT COUNT(*) FROM site_content) AS content,
      (SELECT COUNT(*) FROM admin_sessions) AS sessions,
      (SELECT COUNT(*) FROM app_settings) AS settings
  `);
  const target = targetRows[0];
  if (Object.values(target).some((count) => Number(count) !== 0)) {
    throw new Error('The target MySQL tables are not empty. Refusing to overwrite existing data.');
  }

  const users = sqlite.prepare(
    'SELECT id, email, name, password_hash, password_salt, role FROM users ORDER BY id',
  ).all();
  const sqliteProductColumns = sqlite.prepare('PRAGMA table_info(products)').all();
  const hasPlacementsColumn = sqliteProductColumns.some((column) => column.name === 'placements');
  const hasBrandColumn = sqliteProductColumns.some((column) => column.name === 'brand');
  const products = sqlite.prepare(`
    SELECT id, slug, name, category, price, original_price, rating, reviews, badge, image,
      short_description, description, ingredients, benefits, sizes, stock, featured,
      new_arrival, ${hasPlacementsColumn ? 'placements' : "NULL AS placements"}, collection,
      ${hasBrandColumn ? 'brand' : 'NULL AS brand'}
    FROM products ORDER BY id
  `).all();
  const content = sqlite.prepare('SELECT key, value FROM site_content ORDER BY key').all();
  const categories = hasSqliteTable('categories')
    ? sqlite.prepare('SELECT id, name, slug, image, sort_order FROM categories ORDER BY sort_order, id').all()
    : [];
  const collections = hasSqliteTable('collections')
    ? sqlite.prepare('SELECT id, name, slug, description, image, sort_order FROM collections ORDER BY sort_order, id').all()
    : [...new Map(products.filter((product) => product.collection).map((product) => [
      product.collection,
      { name: product.collection, slug: String(product.collection).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), description: `${product.collection} collection`, image: product.image, sort_order: 0 },
    ])).values()].map((item, index) => ({ id: index + 1, ...item }));
  const brands = hasSqliteTable('brands')
    ? sqlite.prepare('SELECT id, name, slug, description, image, sort_order FROM brands ORDER BY sort_order, id').all()
    : [...new Map(products.filter((product) => product.brand).map((product) => [
      product.brand,
      { name: product.brand, slug: String(product.brand).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), description: `${product.brand} brand`, image: product.image, sort_order: 0 },
    ])).values()].map((item, index) => ({ id: index + 1, ...item }));
  const blogPosts = hasSqliteTable('blog_posts')
    ? sqlite.prepare('SELECT id, slug, title, excerpt, content, category, image, author, published, published_at FROM blog_posts ORDER BY id').all()
    : [];

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const user of users) {
      await connection.execute(
        'INSERT INTO users (id, email, name, password_hash, password_salt, `role`) VALUES (?, ?, ?, ?, ?, ?)',
        [user.id, user.email, user.name, user.password_hash, user.password_salt, user.role],
      );
    }

    for (const product of products) {
      await connection.execute(
        `INSERT INTO products (
          id, slug, name, category, price, original_price, rating, reviews, badge, image,
          short_description, description, ingredients, benefits, sizes, stock, featured,
          new_arrival, placements, collection, brand
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          product.id,
          product.slug,
          product.name,
          product.category,
          product.price,
          product.original_price,
          product.rating,
          product.reviews,
          product.badge,
          product.image,
          product.short_description,
          product.description,
          jsonValue(product.ingredients),
          jsonValue(product.benefits),
          jsonValue(product.sizes),
          product.stock,
          product.featured,
          product.new_arrival,
          productPlacements(product),
          product.collection,
          product.brand,
        ],
      );
    }

    for (const category of categories) {
      await connection.execute(
        'INSERT INTO categories (id, name, slug, image, sort_order) VALUES (?, ?, ?, ?, ?)',
        [category.id, category.name, category.slug, category.image, category.sort_order],
      );
    }

    for (const collection of collections) {
      await connection.execute(
        'INSERT INTO collections (id, name, slug, description, image, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [collection.id, collection.name, collection.slug, collection.description, collection.image, collection.sort_order],
      );
    }

    for (const brand of brands) {
      await connection.execute(
        'INSERT INTO brands (id, name, slug, description, image, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [brand.id, brand.name, brand.slug, brand.description, brand.image, brand.sort_order],
      );
    }

    for (const post of blogPosts) {
      await connection.execute(
        `INSERT INTO blog_posts
          (id, slug, title, excerpt, content, category, image, author, published, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [post.id, post.slug, post.title, post.excerpt, post.content, post.category, post.image,
          post.author, post.published, post.published_at],
      );
    }

    for (const item of content) {
      await connection.execute(
        'INSERT INTO site_content (content_key, content_value) VALUES (?, ?)',
        [item.key, item.value],
      );
    }

    if (products.length > 0) {
      await connection.execute(
        'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)',
        ['initial_catalog_seeded', '1'],
      );
    }
    if (categories.length > 0) {
      await connection.execute(
        'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)',
        ['default_categories_seeded', '1'],
      );
    }
    if (collections.length > 0) {
      await connection.execute(
        'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)',
        ['initial_collections_seeded', '1'],
      );
    }
    if (blogPosts.length > 0) {
      await connection.execute(
        'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)',
        ['default_blog_seeded', '1'],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  console.log(`Migrated ${users.length} user(s), ${products.length} product(s), ${categories.length} category(ies), ${collections.length} collection(s), ${brands.length} brand(s), ${blogPosts.length} blog post(s), and ${content.length} CMS field(s).`);
  console.log('The original data/zodiac.db file was not modified. Existing admin passwords should be rotated.');
} finally {
  sqlite.close();
  await pool.end();
}
