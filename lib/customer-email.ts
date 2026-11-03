import nodemailer from 'nodemailer';

import type { CustomerOrder } from '@/lib/customer-types';

function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from) {
    return null;
  }
  return {
    from,
    transport: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
    }),
  };
}

export async function sendOrderConfirmation(order: CustomerOrder) {
  const emailConfig = getTransport();
  if (!emailConfig || !order.email) return;

  const lines = order.items.map((item) =>
    `${item.productName} x ${item.quantity} - $${(item.unitPrice * item.quantity).toFixed(2)}`,
  );
  await emailConfig.transport.sendMail({
    from: emailConfig.from,
    to: order.email,
    subject: `Order ${order.orderNumber} received`,
    text: [
      `Thank you for your order, ${order.contactName}.`,
      `Order: ${order.orderNumber}`,
      ...lines,
      `Total: $${order.total.toFixed(2)}`,
      `Payment: ${order.paymentMethod === 'mpesa' ? 'M-Pesa (payment pending)' : 'Cash on delivery'}`,
      'You can view updates in your Zodiac Beauty account.',
    ].join('\n'),
  });
}

export async function sendOrderStatusUpdate(order: CustomerOrder) {
  const emailConfig = getTransport();
  if (!emailConfig || !order.email) return;
  await emailConfig.transport.sendMail({
    from: emailConfig.from,
    to: order.email,
    subject: `Order ${order.orderNumber} update`,
    text: `Your Zodiac Beauty order ${order.orderNumber} is now ${order.status.replaceAll('_', ' ')}. Payment status: ${order.paymentStatus.replaceAll('_', ' ')}. View the latest details in your account.`,
  });
}
