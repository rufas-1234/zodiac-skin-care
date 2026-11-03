import { createHash, pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { normalizeProductImageUrl } from '@/lib/product-images';
import type {
  CustomerAccount,
  CustomerOrder,
  CustomerOrderItem,
  NewOrderInput,
} from '@/lib/customer-types';
import {
  CustomerAccountError,
  CustomerLoginRateLimitError,
  CustomerOrderError,
} from '@/lib/customer-types';

const databasePath = path.join(process.cwd(), 'data', 'zodiac.db');
const pbkdf2Async = promisify(pbkdf2);
const customerSessionSeconds = 30 * 24 * 60 * 60;
const customerPasswordIterations = 600_000;
const passwordLoginWindowMilliseconds = 15 * 60 * 1000;
const passwordLoginMaxAttempts = 10;
const codeTtlMilliseconds = 10 * 60 * 1000;
const codeResendMilliseconds = 60 * 1000;
const codeRequestsPerHour = 5;
const codeRequestWindowMilliseconds = 60 * 60 * 1000;
const maxCodeAttempts = 5;

type CustomerRow = {
  id: number;
  phone: string | null;
  username: string | null;
  name: string;
  email: string | null;
};

async function verifyCustomerPassword(password: string, passwordHash: string | null) {
  if (!passwordHash) {
    await pbkdf2Async(password, 'customer-login-dummy-salt', customerPasswordIterations, 64, 'sha256');
    return false;
  }
  const [algorithm, iterationsValue, salt, expectedHash] = passwordHash.split('$');
  const iterations = Number(iterationsValue);
  if (
    algorithm !== 'pbkdf2-sha256'
    || !Number.isInteger(iterations)
    || iterations !== customerPasswordIterations
    || !salt
    || !/^[a-f0-9]{128}$/i.test(expectedHash || '')
  ) {
    throw new Error('Stored customer password hash is invalid.');
  }
  const candidate = await pbkdf2Async(password, salt, iterations, 64, 'sha256');
  return timingSafeEqual(candidate, Buffer.from(expectedHash, 'hex'));
}

type OrderRow = {
  id: number;
  customer_id: number;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  shipping: number;
  total: number;
  contact_name: string;
  phone: string;
  email: string | null;
  address_line1: string;
  address_line2: string;
  city: string;
  postal_code: string;
  created_at: string;
};

function openDatabase() {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      username TEXT COLLATE NOCASE UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL DEFAULT '',
      email TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customer_sessions (
      token_hash TEXT NOT NULL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customer_login_challenges (
      phone TEXT NOT NULL PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS customer_login_rate_limits (
      phone TEXT NOT NULL PRIMARY KEY,
      window_started_at TEXT NOT NULL,
      request_count INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customer_password_login_limits (
      username TEXT NOT NULL PRIMARY KEY COLLATE NOCASE,
      window_started_at TEXT NOT NULL,
      attempt_count INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customer_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      subtotal REAL NOT NULL,
      shipping REAL NOT NULL,
      total REAL NOT NULL,
      contact_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL,
      postal_code TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customer_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      product_image TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS customer_sessions_customer_idx ON customer_sessions(customer_id);
    CREATE INDEX IF NOT EXISTS customer_orders_customer_created_idx ON customer_orders(customer_id, created_at);
    CREATE INDEX IF NOT EXISTS customer_order_items_order_idx ON customer_order_items(order_id);
  `);
  const customerColumns = db.prepare('PRAGMA table_info(customers)').all() as Array<{
    name: string;
    notnull: number;
  }>;
  const customerColumnNames = new Set(customerColumns.map((column) => column.name));
  const needsCustomerRebuild = customerColumns.some((column) => column.name === 'phone' && column.notnull === 1)
    || !customerColumnNames.has('username')
    || !customerColumnNames.has('password_hash');

  if (needsCustomerRebuild) {
    const usernameValue = customerColumnNames.has('username') ? 'username' : 'NULL';
    const passwordValue = customerColumnNames.has('password_hash') ? 'password_hash' : 'NULL';
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(`
        CREATE TABLE customers_next (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone TEXT UNIQUE,
          username TEXT COLLATE NOCASE UNIQUE,
          password_hash TEXT,
          name TEXT NOT NULL DEFAULT '',
          email TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO customers_next (id, phone, username, password_hash, name, email, created_at, updated_at)
        SELECT id, phone, ${usernameValue}, ${passwordValue}, name, email, created_at, updated_at FROM customers;

        CREATE TABLE customer_sessions_next (
          token_hash TEXT NOT NULL PRIMARY KEY,
          customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO customer_sessions_next SELECT * FROM customer_sessions;

        CREATE TABLE customer_orders_next (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_number TEXT NOT NULL UNIQUE,
          customer_id INTEGER NOT NULL REFERENCES customers(id),
          status TEXT NOT NULL DEFAULT 'pending',
          payment_method TEXT NOT NULL,
          payment_status TEXT NOT NULL DEFAULT 'pending',
          subtotal REAL NOT NULL,
          shipping REAL NOT NULL,
          total REAL NOT NULL,
          contact_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          email TEXT,
          address_line1 TEXT NOT NULL,
          address_line2 TEXT NOT NULL DEFAULT '',
          city TEXT NOT NULL,
          postal_code TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO customer_orders_next SELECT * FROM customer_orders;

        CREATE TABLE customer_order_items_next (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
          product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
          product_name TEXT NOT NULL,
          product_image TEXT NOT NULL,
          unit_price REAL NOT NULL,
          quantity INTEGER NOT NULL
        );
        INSERT INTO customer_order_items_next SELECT * FROM customer_order_items;

        DROP TABLE customer_order_items;
        DROP TABLE customer_orders;
        DROP TABLE customer_sessions;
        DROP TABLE customers;
        ALTER TABLE customers_next RENAME TO customers;
        ALTER TABLE customer_sessions_next RENAME TO customer_sessions;
        ALTER TABLE customer_orders_next RENAME TO customer_orders;
        ALTER TABLE customer_order_items_next RENAME TO customer_order_items;
      `);
      db.exec('COMMIT;');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK;');
      db.exec('PRAGMA foreign_keys = ON;');
      throw error;
    }
    db.exec('PRAGMA foreign_keys = ON;');
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS customers_username_unique
      ON customers(username COLLATE NOCASE)
      WHERE username IS NOT NULL;
    CREATE INDEX IF NOT EXISTS customer_sessions_customer_idx ON customer_sessions(customer_id);
    CREATE INDEX IF NOT EXISTS customer_orders_customer_created_idx ON customer_orders(customer_id, created_at);
    CREATE INDEX IF NOT EXISTS customer_order_items_order_idx ON customer_order_items(order_id);
  `);
  const foreignKeyErrors = db.prepare('PRAGMA foreign_key_check').all();
  if (foreignKeyErrors.length > 0) {
    throw new Error('Customer account database migration left invalid foreign-key references.');
  }
  return db;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createUsernameCustomer(
  username: string,
  passwordHash: string,
  name: string,
  email: string | null,
) {
  const db = openDatabase();
  try {
    const result = db.prepare(
      'INSERT INTO customers (username, password_hash, name, email) VALUES (?, ?, ?, ?)',
    ).run(username, passwordHash, name, email);
    return {
      id: Number(result.lastInsertRowid),
      phone: null,
      username,
      name,
      email,
    } satisfies CustomerAccount;
  } catch (error) {
    if (error instanceof Error && /unique constraint/i.test(error.message)) {
      throw new CustomerAccountError('That username is already taken.');
    }
    throw error;
  } finally {
    db.close();
  }
}

export async function authenticateUsernameCustomer(username: string, password: string) {
  const db = openDatabase();
  try {
    db.exec('BEGIN IMMEDIATE');
    const now = Date.now();
    const limit = db.prepare(
      'SELECT window_started_at, attempt_count FROM customer_password_login_limits WHERE username = ? COLLATE NOCASE',
    ).get(username) as { window_started_at: string; attempt_count: number } | undefined;
    const activeWindow = limit && now - new Date(limit.window_started_at).getTime() < passwordLoginWindowMilliseconds;
    if (activeWindow && Number(limit.attempt_count) >= passwordLoginMaxAttempts) {
      db.exec('ROLLBACK');
      throw new CustomerLoginRateLimitError('Too many sign-in attempts. Please wait 15 minutes and try again.');
    }
    db.prepare(`
      INSERT INTO customer_password_login_limits (username, window_started_at, attempt_count)
      VALUES (?, ?, 1)
      ON CONFLICT(username) DO UPDATE SET
        window_started_at = CASE WHEN ? = 1 THEN window_started_at ELSE excluded.window_started_at END,
        attempt_count = CASE WHEN ? = 1 THEN attempt_count + 1 ELSE 1 END
    `).run(
      username,
      new Date(now).toISOString(),
      activeWindow ? 1 : 0,
      activeWindow ? 1 : 0,
    );
    db.exec('COMMIT');

    const customer = db.prepare(`
      SELECT id, phone, username, password_hash, name, email
      FROM customers WHERE username = ? COLLATE NOCASE LIMIT 1
    `).get(username) as (CustomerRow & { password_hash: string | null }) | undefined;
    if (!(await verifyCustomerPassword(password, customer?.password_hash ?? null)) || !customer) {
      return null;
    }
    db.prepare('DELETE FROM customer_password_login_limits WHERE username = ?').run(username);
    return toCustomer(customer);
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

export async function addCustomerPasswordLogin(
  customerId: number,
  username: string,
  passwordHash: string,
) {
  const db = openDatabase();
  try {
    const result = db.prepare(`
      UPDATE customers SET username = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND username IS NULL AND password_hash IS NULL
    `).run(username, passwordHash, customerId);
    if (result.changes === 1) return true;
    const customer = db.prepare('SELECT username FROM customers WHERE id = ?').get(customerId);
    if (!customer) return false;
    throw new CustomerAccountError('This account already has username and password sign-in enabled.');
  } catch (error) {
    if (error instanceof Error && /unique constraint/i.test(error.message)) {
      throw new CustomerAccountError('That username is already taken.');
    }
    throw error;
  } finally {
    db.close();
  }
}

function toCustomer(row: CustomerRow): CustomerAccount {
  return {
    id: Number(row.id),
    phone: row.phone,
    username: row.username,
    name: row.name,
    email: row.email,
  };
}

function toOrder(row: OrderRow, items: CustomerOrderItem[]): CustomerOrder {
  return {
    id: Number(row.id),
    orderNumber: row.order_number,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    subtotal: Number(row.subtotal),
    shipping: Number(row.shipping),
    total: Number(row.total),
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    postalCode: row.postal_code,
    createdAt: row.created_at,
    items,
  };
}

export async function requestCustomerLoginCode(phone: string, codeHash: string) {
  const db = openDatabase();
  try {
    db.exec('BEGIN IMMEDIATE');
    const challenge = db.prepare(
      'SELECT sent_at FROM customer_login_challenges WHERE phone = ?',
    ).get(phone) as { sent_at: string } | undefined;
    const now = Date.now();
    const rate = db.prepare(
      'SELECT window_started_at, request_count FROM customer_login_rate_limits WHERE phone = ?',
    ).get(phone) as { window_started_at: string; request_count: number } | undefined;
    const rateWindowActive = rate && now - new Date(rate.window_started_at).getTime() < codeRequestWindowMilliseconds;
    if (
      (rateWindowActive && Number(rate.request_count) >= codeRequestsPerHour)
      || (challenge && now - new Date(challenge.sent_at).getTime() < codeResendMilliseconds)
    ) {
      db.exec('ROLLBACK');
      return false;
    }

    db.prepare(`
      INSERT INTO customer_login_rate_limits (phone, window_started_at, request_count)
      VALUES (?, ?, 1)
      ON CONFLICT(phone) DO UPDATE SET
        window_started_at = CASE WHEN ? = 1 THEN window_started_at ELSE excluded.window_started_at END,
        request_count = CASE WHEN ? = 1 THEN request_count + 1 ELSE 1 END
    `).run(
      phone,
      new Date(now).toISOString(),
      rateWindowActive ? 1 : 0,
      rateWindowActive ? 1 : 0,
    );
    db.prepare(`
      INSERT INTO customer_login_challenges (phone, code_hash, expires_at, sent_at, attempts)
      VALUES (?, ?, ?, ?, 0)
      ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash,
        expires_at = excluded.expires_at, sent_at = excluded.sent_at, attempts = 0
    `).run(
      phone,
      codeHash,
      new Date(Date.now() + codeTtlMilliseconds).toISOString(),
      new Date().toISOString(),
    );
    db.exec('COMMIT');
    return true;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

export async function verifyCustomerLoginCode(phone: string, submittedCodeHash: string): Promise<CustomerAccount | null> {
  const db = openDatabase();
  try {
    db.exec('BEGIN IMMEDIATE');
    const challenge = db.prepare(`
      SELECT code_hash, attempts FROM customer_login_challenges
      WHERE phone = ? AND expires_at > ?
    `).get(phone, new Date().toISOString()) as { code_hash: string; attempts: number } | undefined;
    if (!challenge) {
      db.exec('ROLLBACK');
      return null;
    }

    const storedHash = Buffer.from(challenge.code_hash, 'hex');
    const submittedHash = Buffer.from(submittedCodeHash, 'hex');
    const matches = storedHash.length === submittedHash.length
      && timingSafeEqual(storedHash, submittedHash);
    if (!matches) {
      if (Number(challenge.attempts) >= maxCodeAttempts - 1) {
        db.prepare('DELETE FROM customer_login_challenges WHERE phone = ?').run(phone);
      } else {
        db.prepare('UPDATE customer_login_challenges SET attempts = attempts + 1 WHERE phone = ?').run(phone);
      }
      db.exec('COMMIT');
      return null;
    }

    db.prepare('DELETE FROM customer_login_challenges WHERE phone = ?').run(phone);
    db.prepare(`
      INSERT INTO customers (phone, name) VALUES (?, '')
      ON CONFLICT(phone) DO NOTHING
    `).run(phone);
    const customer = db.prepare(
      'SELECT id, phone, username, name, email FROM customers WHERE phone = ? LIMIT 1',
    ).get(phone) as CustomerRow | undefined;
    db.exec('COMMIT');
    return customer ? toCustomer(customer) : null;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

export async function linkCustomerPhone(
  customerId: number,
  phone: string,
  submittedCodeHash: string,
): Promise<CustomerAccount | null> {
  const db = openDatabase();
  try {
    db.exec('BEGIN IMMEDIATE');
    const challenge = db.prepare(`
      SELECT code_hash, attempts FROM customer_login_challenges
      WHERE phone = ? AND expires_at > ?
    `).get(phone, new Date().toISOString()) as { code_hash: string; attempts: number } | undefined;
    if (!challenge) {
      db.exec('ROLLBACK');
      return null;
    }

    const storedHash = Buffer.from(challenge.code_hash, 'hex');
    const submittedHash = Buffer.from(submittedCodeHash, 'hex');
    const matches = storedHash.length === submittedHash.length
      && timingSafeEqual(storedHash, submittedHash);
    if (!matches) {
      if (Number(challenge.attempts) >= maxCodeAttempts - 1) {
        db.prepare('DELETE FROM customer_login_challenges WHERE phone = ?').run(phone);
      } else {
        db.prepare('UPDATE customer_login_challenges SET attempts = attempts + 1 WHERE phone = ?').run(phone);
      }
      db.exec('COMMIT');
      return null;
    }

    const customer = db.prepare(
      'SELECT id FROM customers WHERE id = ?',
    ).get(customerId) as { id: number } | undefined;
    if (!customer) {
      db.exec('ROLLBACK');
      return null;
    }
    const existing = db.prepare(
      'SELECT id FROM customers WHERE phone = ?',
    ).get(phone) as { id: number } | undefined;
    if (existing && Number(existing.id) !== customerId) {
      db.exec('ROLLBACK');
      throw new CustomerAccountError('That phone number is already linked to another account.');
    }

    db.prepare('UPDATE customers SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(phone, customerId);
    db.prepare('DELETE FROM customer_login_challenges WHERE phone = ?').run(phone);
    const updated = db.prepare(
      'SELECT id, phone, username, name, email FROM customers WHERE id = ?',
    ).get(customerId) as CustomerRow | undefined;
    db.exec('COMMIT');
    return updated ? toCustomer(updated) : null;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

export async function createCustomerSession(customerId: number) {
  const db = openDatabase();
  try {
    const token = randomBytes(32).toString('base64url');
    db.prepare(
      'INSERT INTO customer_sessions (token_hash, customer_id, expires_at) VALUES (?, ?, ?)',
    ).run(
      hashToken(token),
      customerId,
      new Date(Date.now() + customerSessionSeconds * 1000).toISOString(),
    );
    return { token, maxAge: customerSessionSeconds };
  } finally {
    db.close();
  }
}

export async function readCustomerBySession(token: string): Promise<CustomerAccount | null> {
  const db = openDatabase();
  try {
    const customer = db.prepare(`
      SELECT customers.id, customers.phone, customers.username, customers.name, customers.email
      FROM customer_sessions
      INNER JOIN customers ON customers.id = customer_sessions.customer_id
      WHERE customer_sessions.token_hash = ? AND customer_sessions.expires_at > ?
      LIMIT 1
    `).get(hashToken(token), new Date().toISOString()) as CustomerRow | undefined;
    return customer ? toCustomer(customer) : null;
  } finally {
    db.close();
  }
}

export async function deleteCustomerSession(token: string) {
  const db = openDatabase();
  try {
    db.prepare('DELETE FROM customer_sessions WHERE token_hash = ?').run(hashToken(token));
  } finally {
    db.close();
  }
}

export async function updateCustomerProfile(customerId: number, name: string, email: string | null) {
  const db = openDatabase();
  try {
    return db.prepare(
      'UPDATE customers SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).run(name, email, customerId).changes > 0;
  } finally {
    db.close();
  }
}

export async function createCustomerOrder(customerId: number, input: NewOrderInput) {
  const db = openDatabase();
  try {
    db.exec('BEGIN IMMEDIATE');
    const customer = db.prepare(
      'SELECT id, phone, name, email FROM customers WHERE id = ?',
    ).get(customerId) as CustomerRow | undefined;
    if (!customer) throw new CustomerOrderError('Sign in before placing your order.');

    const itemData = input.items.map((item) => {
      const product = db.prepare(
        'SELECT id, name, image, price, stock FROM products WHERE id = ?',
      ).get(item.productId) as {
        id: number;
        name: string;
        image: string;
        price: number;
        stock: number;
      } | undefined;
      if (!product || Number(product.stock) < item.quantity) {
        throw new CustomerOrderError('A product is no longer available in the requested quantity. Review your cart and try again.');
      }
      return {
        product,
        quantity: item.quantity,
        unitPrice: Math.round(Number(product.price) * 100) / 100,
      };
    });

    const subtotalCents = itemData.reduce(
      (sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity,
      0,
    );
    const subtotal = subtotalCents / 100;
    const shipping = subtotal === 0 || subtotal > 120 ? 0 : 18;
    const total = subtotal + shipping;
    const orderNumber = `ZB-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const result = db.prepare(`
      INSERT INTO customer_orders
        (order_number, customer_id, status, payment_method, payment_status, subtotal, shipping, total,
         contact_name, phone, email, address_line1, address_line2, city, postal_code)
      VALUES (?, ?, 'pending', ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderNumber,
      customerId,
      input.paymentMethod,
      subtotal,
      shipping,
      total,
      input.contactName,
      input.phone,
      input.email ?? customer.email,
      input.addressLine1,
      input.addressLine2,
      input.city,
      input.postalCode,
    );
    const orderId = Number(result.lastInsertRowid);

    for (const item of itemData) {
      const stockResult = db.prepare(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
      ).run(item.quantity, item.product.id, item.quantity);
      if (stockResult.changes !== 1) {
        throw new CustomerOrderError('A product is no longer available in the requested quantity. Review your cart and try again.');
      }
      db.prepare(`
        INSERT INTO customer_order_items
          (order_id, product_id, product_name, product_image, unit_price, quantity)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        item.product.id,
        item.product.name,
        normalizeProductImageUrl(item.product.image),
        item.unitPrice,
        item.quantity,
      );
    }

    db.exec('COMMIT');
    return {
      id: orderId,
      orderNumber,
      status: 'pending',
      paymentMethod: input.paymentMethod,
      paymentStatus: 'pending',
      subtotal,
      shipping,
      total,
      contactName: input.contactName,
      phone: input.phone,
      email: input.email ?? customer.email,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      postalCode: input.postalCode,
      createdAt: new Date().toISOString(),
      items: itemData.map((item) => ({
        id: item.product.id,
        productName: item.product.name,
        productImage: normalizeProductImageUrl(item.product.image),
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
    } satisfies CustomerOrder;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

function readOrders(db: DatabaseSync, where: string, parameters: number[]) {
  const rows = db.prepare(
    `SELECT * FROM customer_orders ${where} ORDER BY created_at DESC LIMIT 100`,
  ).all(...parameters) as unknown as OrderRow[];
  if (rows.length === 0) return [];
  const orderIds = rows.map((row) => row.id);
  const itemRows = db.prepare(
    `SELECT id, order_id, product_name, product_image, unit_price, quantity
     FROM customer_order_items WHERE order_id IN (${orderIds.map(() => '?').join(', ')}) ORDER BY id`,
  ).all(...orderIds) as Array<{
    id: number;
    order_id: number;
    product_name: string;
    product_image: string;
    unit_price: number;
    quantity: number;
  }>;
  const itemsByOrder = new Map<number, CustomerOrderItem[]>();
  for (const item of itemRows) {
    const items = itemsByOrder.get(item.order_id) ?? [];
    items.push({
      id: Number(item.id),
      productName: item.product_name,
      productImage: normalizeProductImageUrl(item.product_image),
      unitPrice: Number(item.unit_price),
      quantity: Number(item.quantity),
    });
    itemsByOrder.set(item.order_id, items);
  }
  return rows.map((row) => toOrder(row, itemsByOrder.get(row.id) ?? []));
}

export async function listCustomerOrders(customerId: number) {
  const db = openDatabase();
  try {
    return readOrders(db, 'WHERE customer_id = ?', [customerId]);
  } finally {
    db.close();
  }
}

export async function listAdminCustomerOrders() {
  const db = openDatabase();
  try {
    return readOrders(db, '', []);
  } finally {
    db.close();
  }
}

export async function updateCustomerOrderStatus(orderId: number, status: string, paymentStatus: string) {
  const db = openDatabase();
  try {
    db.exec('BEGIN IMMEDIATE');
    const order = db.prepare('SELECT status FROM customer_orders WHERE id = ?').get(orderId) as { status: string } | undefined;
    if (!order) {
      db.exec('ROLLBACK');
      return false;
    }
    if (order.status === 'cancelled' && status !== 'cancelled') {
      throw new CustomerOrderError('Cancelled orders cannot be reopened.');
    }
    if (status === 'cancelled' && !['pending', 'processing'].includes(order.status)) {
      throw new CustomerOrderError('Only pending or processing orders can be cancelled.');
    }
    if (status === 'cancelled' && order.status !== 'cancelled') {
      const items = db.prepare(
        'SELECT product_id, quantity FROM customer_order_items WHERE order_id = ?',
      ).all(orderId) as Array<{ product_id: number | null; quantity: number }>;
      for (const item of items) {
        if (item.product_id !== null) {
          db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.product_id);
        }
      }
    }
    db.prepare(
      'UPDATE customer_orders SET status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).run(status, paymentStatus, orderId);
    db.exec('COMMIT');
    return true;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}
