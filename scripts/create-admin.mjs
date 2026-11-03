import { randomBytes, pbkdf2 } from 'node:crypto';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';

const pbkdf2Async = promisify(pbkdf2);
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim();
const password = process.env.ADMIN_PASSWORD;

if (!process.env.MYSQL_HOST || !process.env.MYSQL_DATABASE || !process.env.MYSQL_USER || !process.env.MYSQL_PASSWORD) {
  throw new Error('Set MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, and MYSQL_PASSWORD before creating an admin.');
}
if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('Set ADMIN_EMAIL to a valid email address.');
}
if (!name || name.length > 120) {
  throw new Error('Set ADMIN_NAME to a name of at most 120 characters.');
}
if (!password || password.length < 14 || password.length > 1024) {
  throw new Error('Set ADMIN_PASSWORD to a unique password between 14 and 1024 characters.');
}

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

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(254) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      password_salt VARCHAR(64) NOT NULL DEFAULT '',
      \`role\` VARCHAR(32) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const salt = randomBytes(16).toString('hex');
  const hash = (await pbkdf2Async(password, salt, 600_000, 64, 'sha256')).toString('hex');
  const encodedHash = `pbkdf2-sha256$600000$${salt}$${hash}`;

  await pool.execute(
    `INSERT INTO users (email, name, password_hash, password_salt, \`role\`)
     VALUES (?, ?, ?, '', 'admin')
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash),
       password_salt = '', \`role\` = 'admin'`,
    [email, name, encodedHash],
  );
  console.log(`Admin account created or updated for ${email}.`);
} finally {
  await pool.end();
}
