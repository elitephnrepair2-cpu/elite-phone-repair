export function parseCheckIn(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid check-in');
  const input = value as Record<string, unknown>;
  const text = (name: string, max: number, required = true) => {
    const v = input[name];
    if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Error('Invalid check-in');
    return v.trim();
  };
  const phone = text('phone', 30);
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) throw new Error('Invalid check-in');
  const callBackNumber = text('callBackNumber', 30, false);
  if (callBackNumber && !/^(?:1)?[2-9]\d{2}[2-9]\d{6}$/.test(callBackNumber.replace(/\D/g, ''))) throw new Error('Invalid check-in');
  const location = text('location', 20);
  if (!['Beaumont', 'Houston'].includes(location)) throw new Error('Invalid check-in');
  const requestId = text('requestId', 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new Error('Invalid check-in');
  if (input.transactionalConsent !== true || typeof input.promotionalConsent !== 'boolean') throw new Error('Invalid check-in');
  return {
    requestId, verificationToken: text('verificationToken', 2048),
    payload: {
      name: text('name', 120), phone, email: text('email', 254, false), callBackNumber,
      device: text('device', 160), deviceBrand: text('deviceBrand', 100), deviceModel: text('deviceModel', 160),
      repairCategory: text('repairCategory', 100), problemDescription: text('problemDescription', 2000),
      heardFrom: text('heardFrom', 100), location,
      transactionalConsent: true, promotionalConsent: input.promotionalConsent,
    },
  };
}

export async function readLimitedBody(req: Request, maxBytes = 16384) {
  if (!req.body) throw new Error('Missing body');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('Body too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
