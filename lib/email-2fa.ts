import { createHmac } from 'node:crypto';
import nodemailer from 'nodemailer';

function getEmailConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();
  const secret = process.env.AUTH_SECRET;

  if (
    !host
    || !Number.isInteger(port)
    || port < 1
    || port > 65535
    || !user
    || !password
    || !from
    || !secret
    || Buffer.byteLength(secret, 'utf8') < 32
  ) {
    return null;
  }

  return { host, port, user, password, from, secret };
}

export function isEmailTwoFactorConfigured() {
  return getEmailConfig() !== null;
}

export function hashEmailTwoFactorCode(challengeToken: string, code: string) {
  const config = getEmailConfig();
  if (!config) {
    throw new Error('Email two-factor authentication is not configured.');
  }
  return createHmac('sha256', config.secret)
    .update(`${challengeToken}:${code}`)
    .digest('hex');
}

export async function sendEmailTwoFactorCode(email: string, code: string) {
  const config = getEmailConfig();
  if (!config) {
    throw new Error('Email two-factor authentication is not configured.');
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
  });

  await transport.sendMail({
    from: config.from,
    to: email,
    subject: 'Your Zodiac Beauty sign-in code',
    text: `Your Zodiac Beauty verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    html: `<p>Your Zodiac Beauty verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you did not request this code, you can ignore this email.</p>`,
  });
}
