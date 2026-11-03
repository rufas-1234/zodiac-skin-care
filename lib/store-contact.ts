export const storePhone = process.env.NEXT_PUBLIC_STORE_PHONE?.trim() || '+254 185167903';
export const storePhoneLink = storePhone.replace(/[^\d+]/g, '');
export const storeWhatsAppNumber = storePhone.replace(/\D/g, '');
