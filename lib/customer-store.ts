import { createHash, createHmac, pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDatabase, usesLocalDevelopmentDatabase } from '@/lib/db';
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

const pbkdf2Async = promisify(pbkdf2);
const CUSTOMER_SESSION_SECONDS = 30 * 24 * 60 * 60;
const CUSTOMER_PASSWORD_ITERATIONS = 600_000;
const CODE_TTL_MINUTES = 10;
const CODE_RESEND_SECONDS = 60;
const CODE_REQUESTS_PER_HOUR = 5;
const CODE_REQUEST_WINDOW_MILLISECONDS = 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const PASSWORD_LOGIN_MAX_ATTEMPTS = 10;

type CustomerRow = RowDataPacket & {
  id: number;
  phone: string | null;
  username: string | null;
  name: string;
  email: string | null;
};

type OrderRow = RowDataPacket & {
  id: number;
  customer_id: number;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: number | string;
  shipping: number | string;
  total: number | string;
  contact_name: string;
  phone: string;
  email: string | null;
  address_line1: string;
  address_line2: string;
  city: string;
  postal_code: string;
  created_at: Date | string;
};

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
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

export async function hashCustomerPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await pbkdf2Async(password, salt, CUSTOMER_PASSWORD_ITERATIONS, 64, 'sha256')).toString('hex');
  return `pbkdf2-sha256$${CUSTOMER_PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

async function verifyCustomerPassword(password: string, passwordHash: string | null) {
  if (!passwordHash) {
    await pbkdf2Async(password, 'customer-login-dummy-salt', CUSTOMER_PASSWORD_ITERATIONS, 64, 'sha256');
    return false;
  }
  const [algorithm, iterationsValue, salt, expectedHash] = passwordHash.split('$');
  const iterations = Number(iterationsValue);
  if (
    algorithm !== 'pbkdf2-sha256'
    || !Number.isInteger(iterations)
    || iterations !== CUSTOMER_PASSWORD_ITERATIONS
    || !salt
    || !/^[a-f0-9]{128}$/i.test(expectedHash || '')
  ) {
    throw new Error('Stored customer password hash is invalid.');
  }
  const candidate = await pbkdf2Async(password, salt, iterations, 64, 'sha256');
  return timingSafeEqual(candidate, Buffer.from(expectedHash, 'hex'));
}

export async function createUsernameCustomer(
  username: string,
  password: string,
  name: string,
  email: string | null,
) {
  const passwordHash = await hashCustomerPassword(password);
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.createUsernameCustomer(username, passwordHash, name, email);
  }
  const database = await getDatabase();
  try {
    const [result] = await database.execute<ResultSetHeader>(
      'INSERT INTO customers (username, password_hash, name, email) VALUES (?, ?, ?, ?)',
      [username, passwordHash, name, email],
    );
    return {
      id: result.insertId,
      phone: null,
      username,
      name,
      email,
    } satisfies CustomerAccount;
  } catch (error) {
    if (
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'ER_DUP_ENTRY'
    ) {
      throw new CustomerAccountError('That username is already taken.');
    }
    throw error;
  }
}

export async function authenticateUsernameCustomer(username: string, password: string) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.authenticateUsernameCustomer(username, password);
  }
  const database = await getDatabase();
  await database.execute(
    `INSERT INTO customer_password_login_limits (username, window_started_at, attempt_count)
     VALUES (?, UTC_TIMESTAMP(3), 1)
     ON DUPLICATE KEY UPDATE
       attempt_count = IF(window_started_at > DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 15 MINUTE), attempt_count + 1, 1),
       window_started_at = IF(window_started_at > DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 15 MINUTE), window_started_at, UTC_TIMESTAMP(3))`,
    [username],
  );
  const [limitRows] = await database.execute<Array<RowDataPacket & { attempt_count: number }>>(
    'SELECT attempt_count FROM customer_password_login_limits WHERE username = ?',
    [username],
  );
  if (Number(limitRows[0]?.attempt_count) > PASSWORD_LOGIN_MAX_ATTEMPTS) {
    throw new CustomerLoginRateLimitError('Too many sign-in attempts. Please wait 15 minutes and try again.');
  }
  const [rows] = await database.execute<Array<CustomerRow & { password_hash: string | null }>>(
    'SELECT id, phone, username, password_hash, name, email FROM customers WHERE username = ? LIMIT 1',
    [username],
  );
  const customer = rows[0];
  if (!(await verifyCustomerPassword(password, customer?.password_hash ?? null)) || !customer) {
    return null;
  }
  await database.execute('DELETE FROM customer_password_login_limits WHERE username = ?', [username]);
  return toCustomer(customer);
}

export async function addCustomerPasswordLogin(
  customerId: number,
  username: string,
  password: string,
) {
  const passwordHash = await hashCustomerPassword(password);
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.addCustomerPasswordLogin(customerId, username, passwordHash);
  }
  const database = await getDatabase();
  try {
    const [result] = await database.execute<ResultSetHeader>(
      'UPDATE customers SET username = ?, password_hash = ? WHERE id = ? AND username IS NULL AND password_hash IS NULL',
      [username, passwordHash, customerId],
    );
    if (result.affectedRows === 1) return true;
    const [rows] = await database.execute<Array<RowDataPacket & { username: string | null }>>(
      'SELECT username FROM customers WHERE id = ? LIMIT 1',
      [customerId],
    );
    if (!rows[0]) return false;
    throw new CustomerAccountError('This account already has username and password sign-in enabled.');
  } catch (error) {
    if (
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'ER_DUP_ENTRY'
    ) {
      throw new CustomerAccountError('That username is already taken.');
    }
    throw error;
  }
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
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    items,
  };
}

function normalizeCodeHash(phone: string, code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('AUTH_SECRET must contain at least 32 characters to protect customer sign-in codes.');
  }
  return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}

export async function makeCustomerCodeHash(phone: string, code: string) {
  return normalizeCodeHash(phone, code);
}

export async function requestCustomerLoginCode(phone: string, codeHash: string) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.requestCustomerLoginCode(phone, codeHash);
  }

  const database = await getDatabase();
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [rateRows] = await connection.execute<Array<RowDataPacket & {
      window_started_at: Date | string;
      request_count: number;
    }>>(
      'SELECT window_started_at, request_count FROM customer_login_rate_limits WHERE phone = ? FOR UPDATE',
      [phone],
    );
    const now = Date.now();
    const rate = rateRows[0];
    const rateWindowStartedAt = rate ? new Date(rate.window_started_at).getTime() : now;
    const rateWindowActive = rate && now - rateWindowStartedAt < CODE_REQUEST_WINDOW_MILLISECONDS;
    if (rateWindowActive && Number(rate.request_count) >= CODE_REQUESTS_PER_HOUR) {
      await connection.rollback();
      return false;
    }

    const [existingRows] = await connection.execute<Array<RowDataPacket & { sent_at: Date | string }>>(
      'SELECT sent_at FROM customer_login_challenges WHERE phone = ? FOR UPDATE',
      [phone],
    );
    const lastSentAt = existingRows[0]?.sent_at;
    if (lastSentAt && now - new Date(lastSentAt).getTime() < CODE_RESEND_SECONDS * 1000) {
      await connection.rollback();
      return false;
    }

    await connection.execute(
      `INSERT INTO customer_login_rate_limits (phone, window_started_at, request_count)
       VALUES (?, UTC_TIMESTAMP(3), 1)
       ON DUPLICATE KEY UPDATE
         window_started_at = IF(? = 1, window_started_at, UTC_TIMESTAMP(3)),
         request_count = IF(? = 1, request_count + 1, 1)`,
      [phone, rateWindowActive ? 1 : 0, rateWindowActive ? 1 : 0],
    );
    await connection.execute(
      `INSERT INTO customer_login_challenges (phone, code_hash, expires_at, sent_at, attempts)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), UTC_TIMESTAMP(3), 0)
       ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash),
         expires_at = VALUES(expires_at), sent_at = VALUES(sent_at), attempts = 0`,
      [phone, codeHash, CODE_TTL_MINUTES],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function verifyCustomerLoginCode(phone: string, submittedCodeHash: string): Promise<CustomerAccount | null> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.verifyCustomerLoginCode(phone, submittedCodeHash);
  }

  const database = await getDatabase();
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [challengeRows] = await connection.execute<Array<RowDataPacket & {
      code_hash: string;
      attempts: number;
    }>>(
      `SELECT code_hash, attempts FROM customer_login_challenges
       WHERE phone = ? AND expires_at > UTC_TIMESTAMP() FOR UPDATE`,
      [phone],
    );
    const challenge = challengeRows[0];
    if (!challenge) {
      await connection.rollback();
      return null;
    }

    const storedHash = Buffer.from(challenge.code_hash, 'hex');
    const submittedHash = Buffer.from(submittedCodeHash, 'hex');
    const matches = storedHash.length === submittedHash.length
      && timingSafeEqual(storedHash, submittedHash);
    if (!matches) {
      if (Number(challenge.attempts) >= MAX_CODE_ATTEMPTS - 1) {
        await connection.execute('DELETE FROM customer_login_challenges WHERE phone = ?', [phone]);
      } else {
        await connection.execute(
          'UPDATE customer_login_challenges SET attempts = attempts + 1 WHERE phone = ?',
          [phone],
        );
      }
      await connection.commit();
      return null;
    }

    await connection.execute('DELETE FROM customer_login_challenges WHERE phone = ?', [phone]);
    await connection.execute(
      'INSERT INTO customers (phone, name) VALUES (?, \'\') ON DUPLICATE KEY UPDATE phone = VALUES(phone)',
      [phone],
    );
    const [customerRows] = await connection.execute<CustomerRow[]>(
      'SELECT id, phone, username, name, email FROM customers WHERE phone = ? LIMIT 1',
      [phone],
    );
    await connection.commit();
    return customerRows[0] ? toCustomer(customerRows[0]) : null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function linkCustomerPhone(
  customerId: number,
  phone: string,
  submittedCodeHash: string,
): Promise<CustomerAccount | null> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.linkCustomerPhone(customerId, phone, submittedCodeHash);
  }

  const database = await getDatabase();
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [challengeRows] = await connection.execute<Array<RowDataPacket & {
      code_hash: string;
      attempts: number;
    }>>(
      `SELECT code_hash, attempts FROM customer_login_challenges
       WHERE phone = ? AND expires_at > UTC_TIMESTAMP() FOR UPDATE`,
      [phone],
    );
    const challenge = challengeRows[0];
    if (!challenge) {
      await connection.rollback();
      return null;
    }

    const storedHash = Buffer.from(challenge.code_hash, 'hex');
    const submittedHash = Buffer.from(submittedCodeHash, 'hex');
    const matches = storedHash.length === submittedHash.length
      && timingSafeEqual(storedHash, submittedHash);
    if (!matches) {
      if (Number(challenge.attempts) >= MAX_CODE_ATTEMPTS - 1) {
        await connection.execute('DELETE FROM customer_login_challenges WHERE phone = ?', [phone]);
      } else {
        await connection.execute(
          'UPDATE customer_login_challenges SET attempts = attempts + 1 WHERE phone = ?',
          [phone],
        );
      }
      await connection.commit();
      return null;
    }

    const [customerRows] = await connection.execute<CustomerRow[]>(
      'SELECT id, phone, username, name, email FROM customers WHERE id = ? FOR UPDATE',
      [customerId],
    );
    const customer = customerRows[0];
    if (!customer) {
      await connection.rollback();
      return null;
    }
    const [phoneRows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
      'SELECT id FROM customers WHERE phone = ? FOR UPDATE',
      [phone],
    );
    if (phoneRows[0] && Number(phoneRows[0].id) !== customerId) {
      throw new CustomerAccountError('That phone number is already linked to another account.');
    }

    await connection.execute('UPDATE customers SET phone = ? WHERE id = ?', [phone, customerId]);
    await connection.execute('DELETE FROM customer_login_challenges WHERE phone = ?', [phone]);
    const [updatedRows] = await connection.execute<CustomerRow[]>(
      'SELECT id, phone, username, name, email FROM customers WHERE id = ?',
      [customerId],
    );
    await connection.commit();
    return updatedRows[0] ? toCustomer(updatedRows[0]) : null;
  } catch (error) {
    await connection.rollback();
    if (
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'ER_DUP_ENTRY'
    ) {
      throw new CustomerAccountError('That phone number is already linked to another account.');
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function createCustomerSession(customerId: number) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.createCustomerSession(customerId);
  }
  const database = await getDatabase();
  const token = randomBytes(32).toString('base64url');
  await database.execute(
    'INSERT INTO customer_sessions (token_hash, customer_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))',
    [hashToken(token), customerId, CUSTOMER_SESSION_SECONDS],
  );
  return { token, maxAge: CUSTOMER_SESSION_SECONDS };
}

export async function readCustomerBySession(token: string): Promise<CustomerAccount | null> {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.readCustomerBySession(token);
  }
  const database = await getDatabase();
  const [rows] = await database.execute<CustomerRow[]>(
    `SELECT customers.id, customers.phone, customers.username, customers.name, customers.email
     FROM customer_sessions
     INNER JOIN customers ON customers.id = customer_sessions.customer_id
     WHERE customer_sessions.token_hash = ? AND customer_sessions.expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [hashToken(token)],
  );
  return rows[0] ? toCustomer(rows[0]) : null;
}

export async function deleteCustomerSession(token: string) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.deleteCustomerSession(token);
  }
  const database = await getDatabase();
  await database.execute('DELETE FROM customer_sessions WHERE token_hash = ?', [hashToken(token)]);
}

export async function updateCustomerProfile(customerId: number, name: string, email: string | null) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.updateCustomerProfile(customerId, name, email);
  }
  const database = await getDatabase();
  const [result] = await database.execute<ResultSetHeader>(
    'UPDATE customers SET name = ?, email = ? WHERE id = ?',
    [name, email, customerId],
  );
  return result.affectedRows > 0;
}

export async function createCustomerOrder(customerId: number, input: NewOrderInput) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.createCustomerOrder(customerId, input);
  }

  const database = await getDatabase();
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [customerRows] = await connection.execute<CustomerRow[]>(
      'SELECT id, phone, name, email FROM customers WHERE id = ? FOR UPDATE',
      [customerId],
    );
    const customer = customerRows[0];
    if (!customer) throw new CustomerOrderError('Sign in before placing your order.');

    const productIds = input.items.map((item) => item.productId);
    const placeholders = productIds.map(() => '?').join(', ');
    const [productRows] = await connection.execute<Array<RowDataPacket & {
      id: number;
      name: string;
      image: string;
      price: number | string;
      stock: number;
    }>>(
      `SELECT id, name, image, price, stock FROM products
       WHERE id IN (${placeholders}) FOR UPDATE`,
      productIds,
    );
    const products = new Map(productRows.map((product) => [Number(product.id), product]));
    let subtotalCents = 0;
    const items = input.items.map((item) => {
      const product = products.get(item.productId);
      if (!product || Number(product.stock) < item.quantity) {
        throw new CustomerOrderError('A product is no longer available in the requested quantity. Review your cart and try again.');
      }
      const unitPriceCents = Math.round(Number(product.price) * 100);
      subtotalCents += unitPriceCents * item.quantity;
      return {
        product,
        quantity: item.quantity,
        unitPrice: unitPriceCents / 100,
      };
    });

    const subtotal = subtotalCents / 100;
    const shipping = subtotal === 0 || subtotal > 120 ? 0 : 18;
    const total = subtotal + shipping;
    const orderNumber = `ZB-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const [orderResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO customer_orders
        (order_number, customer_id, status, payment_method, payment_status, subtotal, shipping, total,
         contact_name, phone, email, address_line1, address_line2, city, postal_code)
       VALUES (?, ?, 'pending', ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ],
    );

    for (const item of items) {
      const [stockResult] = await connection.execute<ResultSetHeader>(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [item.quantity, item.product.id, item.quantity],
      );
      if (stockResult.affectedRows !== 1) {
        throw new CustomerOrderError('A product is no longer available in the requested quantity. Review your cart and try again.');
      }
      await connection.execute(
        `INSERT INTO customer_order_items
          (order_id, product_id, product_name, product_image, unit_price, quantity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderResult.insertId,
          item.product.id,
          item.product.name,
          normalizeProductImageUrl(item.product.image),
          item.unitPrice,
          item.quantity,
        ],
      );
    }

    const order: CustomerOrder = {
      id: Number(orderResult.insertId),
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
      items: items.map((item) => ({
        id: item.product.id,
        productName: item.product.name,
        productImage: normalizeProductImageUrl(item.product.image),
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
    };
    await connection.commit();
    return order;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function loadOrders(rows: OrderRow[]) {
  if (rows.length === 0) return [];
  const placeholders = rows.map(() => '?').join(', ');
  const values = rows.map((row) => row.id);
  const query = `SELECT id, order_id, product_name, product_image, unit_price, quantity
    FROM customer_order_items WHERE order_id IN (${placeholders}) ORDER BY id`;
  const [itemRows] = await (await getDatabase()).execute<Array<RowDataPacket & {
      id: number;
      order_id: number;
      product_name: string;
      product_image: string;
      unit_price: number | string;
      quantity: number;
    }>>(query, values);
  const itemsByOrder = new Map<number, CustomerOrderItem[]>();
  for (const row of itemRows) {
    const items = itemsByOrder.get(Number(row.order_id)) ?? [];
    items.push({
      id: Number(row.id),
      productName: row.product_name,
      productImage: normalizeProductImageUrl(row.product_image),
      unitPrice: Number(row.unit_price),
      quantity: Number(row.quantity),
    });
    itemsByOrder.set(Number(row.order_id), items);
  }
  return rows.map((row) => toOrder(row, itemsByOrder.get(Number(row.id)) ?? []));
}

export async function listCustomerOrders(customerId: number) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.listCustomerOrders(customerId);
  }
  const database = await getDatabase();
  const [rows] = await database.execute<OrderRow[]>(
    `SELECT * FROM customer_orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100`,
    [customerId],
  );
  return loadOrders(rows);
}

export async function listAdminCustomerOrders() {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.listAdminCustomerOrders();
  }
  const database = await getDatabase();
  const [rows] = await database.query<OrderRow[]>(
    `SELECT * FROM customer_orders ORDER BY created_at DESC LIMIT 100`,
  );
  const orders = await loadOrders(rows);
  const [customers] = await database.execute<Array<RowDataPacket & { id: number; phone: string }>>(
    `SELECT id, phone FROM customers WHERE id IN (${rows.map(() => '?').join(', ') || 'NULL'})`,
    rows.map((row) => row.id),
  );
  const phoneByCustomer = new Map(customers.map((customer) => [Number(customer.id), customer.phone]));
  return orders.map((order, index) => ({
    ...order,
    phone: phoneByCustomer.get(Number(rows[index]?.customer_id)) ?? order.phone,
  }));
}

export async function updateCustomerOrderStatus(
  orderId: number,
  status: string,
  paymentStatus: string,
) {
  if (usesLocalDevelopmentDatabase()) {
    const localStore = await import('@/lib/customer-store-sqlite');
    return localStore.updateCustomerOrderStatus(orderId, status, paymentStatus);
  }
  const database = await getDatabase();
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<Array<RowDataPacket & { status: string }>>(
      'SELECT status FROM customer_orders WHERE id = ? FOR UPDATE',
      [orderId],
    );
    const existing = rows[0];
    if (!existing) {
      await connection.rollback();
      return false;
    }
    if (existing.status === 'cancelled' && status !== 'cancelled') {
      throw new CustomerOrderError('Cancelled orders cannot be reopened.');
    }
    if (status === 'cancelled' && !['pending', 'processing'].includes(existing.status)) {
      throw new CustomerOrderError('Only pending or processing orders can be cancelled.');
    }
    if (status === 'cancelled' && existing.status !== 'cancelled') {
      const [items] = await connection.execute<Array<RowDataPacket & { product_id: number | null; quantity: number }>>(
        'SELECT product_id, quantity FROM customer_order_items WHERE order_id = ?',
        [orderId],
      );
      for (const item of items) {
        if (item.product_id !== null) {
          await connection.execute(
            'UPDATE products SET stock = stock + ? WHERE id = ?',
            [item.quantity, item.product_id],
          );
        }
      }
    }
    await connection.execute(
      'UPDATE customer_orders SET status = ?, payment_status = ? WHERE id = ?',
      [status, paymentStatus, orderId],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
