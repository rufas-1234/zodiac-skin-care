export type CustomerAccount = {
  id: number;
  phone: string | null;
  username: string | null;
  name: string;
  email: string | null;
};

export type CustomerOrderItem = {
  id: number;
  productName: string;
  productImage: string;
  unitPrice: number;
  quantity: number;
};

export type CustomerOrder = {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  shipping: number;
  total: number;
  contactName: string;
  phone: string;
  email: string | null;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  createdAt: string;
  items: CustomerOrderItem[];
};

export type NewOrderInput = {
  contactName: string;
  phone: string;
  email: string | null;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  paymentMethod: 'cash_on_delivery' | 'mpesa';
  items: Array<{ productId: number; quantity: number }>;
};

export class CustomerOrderError extends Error {}
export class CustomerAccountError extends Error {}
export class CustomerLoginRateLimitError extends Error {}

export function normalizeCustomerPhone(input: string) {
  const value = input.trim();
  const digits = value.replace(/\D/g, '');
  const defaultCountryCode = (process.env.DEFAULT_PHONE_COUNTRY_CODE || '254').replace(/\D/g, '');
  let internationalNumber = digits;

  if (value.startsWith('+')) {
    internationalNumber = digits;
  } else if (digits.startsWith('00')) {
    internationalNumber = digits.slice(2);
  } else if (digits.startsWith('0')) {
    internationalNumber = `${defaultCountryCode}${digits.slice(1)}`;
  } else if (digits.length === 9 && defaultCountryCode === '254') {
    internationalNumber = `${defaultCountryCode}${digits}`;
  }

  if (!/^[1-9]\d{7,14}$/.test(internationalNumber)) {
    return null;
  }
  return `+${internationalNumber}`;
}

export function normalizeCustomerUsername(input: string) {
  const username = input.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) ? username : null;
}
