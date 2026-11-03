function getAfricaTalkingConfig() {
  const username = process.env.AT_USERNAME?.trim();
  const apiKey = process.env.AT_API_KEY?.trim();
  if (!username || !apiKey) return null;
  return {
    username,
    apiKey,
    senderId: process.env.AT_SENDER_ID?.trim(),
    environment: process.env.AT_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production',
  };
}

export function isCustomerSmsConfigured() {
  return Boolean(getAfricaTalkingConfig());
}

export async function sendCustomerLoginCode(phone: string, code: string) {
  const config = getAfricaTalkingConfig();
  if (!config) {
    throw new Error("Africa's Talking SMS is not configured.");
  }

  const body = new URLSearchParams({
    username: config.username,
    to: phone,
    message: `Your Zodiac Beauty sign-in code is ${code}. It expires in 10 minutes. Do not share this code.`,
  });
  if (config.senderId) body.set('from', config.senderId);

  const endpoint = config.environment === 'sandbox'
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      apiKey: config.apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Africa's Talking returned HTTP ${response.status}.`);
  }

  const result: unknown = await response.json();
  if (
    typeof result !== 'object'
    || result === null
    || !('SMSMessageData' in result)
    || typeof result.SMSMessageData !== 'object'
    || result.SMSMessageData === null
    || !('Recipients' in result.SMSMessageData)
    || !Array.isArray(result.SMSMessageData.Recipients)
    || !result.SMSMessageData.Recipients.some((recipient: unknown) =>
      typeof recipient === 'object'
      && recipient !== null
      && 'status' in recipient
      && recipient.status === 'Success')
  ) {
    throw new Error("Africa's Talking did not accept the sign-in code for delivery.");
  }
}
