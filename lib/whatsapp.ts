type SendWhatsAppTextInput = {
  to: string;
  text: string;
};

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('0')) {
    return `94${digits.slice(1)}`;
  }

  if (digits.startsWith('94')) {
    return digits;
  }

  if (digits.length === 9) {
    return `94${digits}`;
  }

  return digits;
}

export function getWhatsAppConfig() {
  return {
    token:
      process.env.WHATSAPP_ACCESS_TOKEN ||
      process.env.WHATSAPP_TOKEN ||
      process.env.WA_ACCESS_TOKEN ||
      '',
    phoneNumberId:
      process.env.WHATSAPP_PHONE_NUMBER_ID ||
      process.env.WHATSAPP_FROM_PHONE_NUMBER_ID ||
      process.env.WA_PHONE_NUMBER_ID ||
      '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v22.0',
  };
}

export async function sendWhatsAppText({ to, text }: SendWhatsAppTextInput) {
  const { token, phoneNumberId, apiVersion } = getWhatsAppConfig();

  if (!token || !phoneNumberId) {
    const missing: string[] = [];
    if (!token) missing.push('access token');
    if (!phoneNumberId) missing.push('phone number id');
    throw new Error(`WhatsApp API is not configured: missing ${missing.join(' and ')}`);
  }

  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) {
    throw new Error('Invalid phone number');
  }

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizedTo,
        type: 'text',
        text: { body: text },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message || data?.error || 'Failed to send WhatsApp message';
    throw new Error(message);
  }

  return data;
}
