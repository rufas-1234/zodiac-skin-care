import { readFile } from 'node:fs/promises';
import path from 'node:path';

import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';

import { categories as defaultCategories, defaultBlogPosts, defaultProducts } from '@/lib/data';
import { DEFAULT_SITE_CONTENT } from '@/lib/site-content';

let pool: Pool | undefined;
let schemaPromise: Promise<void> | undefined;

export function usesLocalDevelopmentDatabase() {
  const credentials = [
    process.env.MYSQL_HOST,
    process.env.MYSQL_DATABASE,
    process.env.MYSQL_USER,
    process.env.MYSQL_PASSWORD,
  ];

  return process.env.NODE_ENV === 'development' && credentials.every((value) => !value);
}

function getPool() {
  if (pool) {
    return pool;
  }

  const host = process.env.MYSQL_HOST;
  const database = process.env.MYSQL_DATABASE;
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const port = Number(process.env.MYSQL_PORT || 3306);

  if (!host || !database || !user || !password || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Database configuration is missing. Set MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, and MYSQL_PASSWORD.');
  }

  pool = mysql.createPool({
    host,
    port,
    database,
    user,
    password,
    waitForConnections: true,
    connectionLimit: 8,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    ssl: {
      minVersion: 'TLSv1.2',
    },
  });

  return pool;
}

async function initializeSchema(connectionPool: Pool) {
  const schema = await readFile(path.join(process.cwd(), 'database', 'schema.sql'), 'utf8');
  for (const statement of schema.split(';').map((part) => part.trim()).filter(Boolean)) {
    await connectionPool.query(statement);
  }

  const [customerColumns] = await connectionPool.execute<Array<RowDataPacket & {
    COLUMN_NAME: string;
    IS_NULLABLE: string;
  }>>(
    `SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers'`,
  );
  const customerColumnNames = new Set(customerColumns.map((column) => column.COLUMN_NAME));
  if (!customerColumnNames.has('username')) {
    await connectionPool.query('ALTER TABLE customers ADD COLUMN username VARCHAR(32) NULL AFTER phone');
  }
  if (!customerColumnNames.has('password_hash')) {
    await connectionPool.query('ALTER TABLE customers ADD COLUMN password_hash VARCHAR(255) NULL AFTER username');
  }
  if (customerColumns.find((column) => column.COLUMN_NAME === 'phone')?.IS_NULLABLE === 'NO') {
    await connectionPool.query('ALTER TABLE customers MODIFY phone VARCHAR(16) NULL');
  }
  const [usernameIndexes] = await connectionPool.execute<RowDataPacket[]>(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'customers_username_unique'`,
  );
  if (usernameIndexes.length === 0) {
    await connectionPool.query('ALTER TABLE customers ADD UNIQUE KEY customers_username_unique (username)');
  }

  const [twoFactorColumns] = await connectionPool.execute<RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_two_factor_enabled'`,
  );
  if (twoFactorColumns.length === 0) {
    await connectionPool.query(
      'ALTER TABLE users ADD COLUMN email_two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER `role`',
    );
  }

  const [placementColumns] = await connectionPool.execute<RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'placements'`,
  );
  if (placementColumns.length === 0) {
    await connectionPool.query(
      'ALTER TABLE products ADD COLUMN placements JSON NULL AFTER new_arrival',
    );
    await connectionPool.query("UPDATE products SET placements = JSON_ARRAY() WHERE placements IS NULL");
    await connectionPool.query(
      "UPDATE products SET placements = JSON_ARRAY_APPEND(placements, '$', 'featured') WHERE featured = 1",
    );
    await connectionPool.query(
      "UPDATE products SET placements = JSON_ARRAY_APPEND(placements, '$', 'new_arrivals') WHERE new_arrival = 1",
    );
    await connectionPool.query(
      'ALTER TABLE products MODIFY placements JSON NOT NULL',
    );
  }

  const [brandColumns] = await connectionPool.execute<RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'brand'`,
  );
  if (brandColumns.length === 0) {
    await connectionPool.query('ALTER TABLE products ADD COLUMN brand VARCHAR(120) NULL AFTER collection');
  }

  const [placementRows] = await connectionPool.query<Array<
    RowDataPacket & { id: number; placements: string | string[]; featured: number; new_arrival: number }
  >>('SELECT id, placements, featured, new_arrival FROM products');
  for (const row of placementRows) {
    const stored: unknown = Array.isArray(row.placements)
      ? row.placements
      : JSON.parse(row.placements || '[]');
    if (!Array.isArray(stored)) {
      throw new Error(`Product ${row.id} has invalid stored placements.`);
    }

    const placements = new Set(stored.filter((placement): placement is string => typeof placement === 'string'));
    placements.delete('best_sellers');
    if (placements.size === 0) {
      if (Number(row.featured) === 1) {
        placements.add('featured');
      }
      if (Number(row.new_arrival) === 1) {
        placements.add('new_arrivals');
      }
    }
    const normalized = JSON.stringify([...placements]);
    if (normalized !== JSON.stringify(stored)) {
      await connectionPool.execute(
        'UPDATE products SET placements = ? WHERE id = ?',
        [normalized, row.id],
      );
    }
  }

  const connection = await connectionPool.getConnection();
  try {
    await connection.beginTransaction();
    const [seedResult] = await connection.execute<ResultSetHeader>(
      'INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)',
      ['initial_catalog_seeded', '1'],
    );

    if (seedResult.affectedRows > 0) {
      const insertProduct = `
        INSERT IGNORE INTO products (
          slug, name, category, price, original_price, rating, reviews, badge, image,
          short_description, description, ingredients, benefits, sizes, stock, featured,
          new_arrival, placements, collection
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const product of defaultProducts) {
        await connection.execute(insertProduct, [
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
        ]);
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  for (const [key, value] of Object.entries(DEFAULT_SITE_CONTENT)) {
    await connectionPool.execute(
      'INSERT IGNORE INTO site_content (content_key, content_value) VALUES (?, ?)',
      [key, value],
    );
  }

  const [categorySeed] = await connectionPool.execute<ResultSetHeader>(
    'INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)',
    ['default_categories_seeded', '1'],
  );
  if (categorySeed.affectedRows > 0) {
    for (const [index, category] of defaultCategories.entries()) {
      await connectionPool.execute(
        'INSERT IGNORE INTO categories (name, slug, image, sort_order) VALUES (?, ?, ?, ?)',
        [
          category.name,
          category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          category.image,
          index,
        ],
      );
    }

  }

  const [collectionSeedRows] = await connectionPool.execute<RowDataPacket[]>(
    'SELECT setting_key FROM app_settings WHERE setting_key = ?',
    ['initial_collections_seeded'],
  );
  if (collectionSeedRows.length === 0) {
    const [productCollections] = await connectionPool.query<Array<RowDataPacket & { name: string; image: string }>>(
      `SELECT collection AS name, MIN(image) AS image FROM products
       WHERE collection <> '' GROUP BY collection ORDER BY collection`,
    );
    for (const [index, collection] of productCollections.entries()) {
      const slug = collection.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (slug) {
        await connectionPool.execute(
          'INSERT IGNORE INTO collections (name, slug, description, image, sort_order) VALUES (?, ?, ?, ?, ?)',
          [collection.name, slug, `${collection.name} collection`, collection.image, index],
        );
      }
    }
    await connectionPool.execute(
      'INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)',
      ['initial_collections_seeded', '1'],
    );
  }

  const [blogSeedRows] = await connectionPool.execute<RowDataPacket[]>(
    'SELECT setting_key FROM app_settings WHERE setting_key = ?',
    ['default_blog_seeded'],
  );
  if (blogSeedRows.length === 0) {
    for (const post of defaultBlogPosts) {
      await connectionPool.execute(
        `INSERT IGNORE INTO blog_posts
          (slug, title, excerpt, content, category, image, author, published, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, UTC_TIMESTAMP())`,
        [post.slug, post.title, post.excerpt, post.content, post.category, post.image, post.author],
      );
    }
    await connectionPool.execute(
      'INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)',
      ['default_blog_seeded', '1'],
    );
  }
}

export async function getDatabase() {
  const connectionPool = getPool();
  if (!schemaPromise) {
    schemaPromise = initializeSchema(connectionPool).catch((error: unknown) => {
      schemaPromise = undefined;
      throw error;
    });
  }

  await schemaPromise;
  return connectionPool;
}
