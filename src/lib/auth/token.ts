export const SESSION_COOKIE = 'jm_session';
export const SESSION_HOURS = 30 * 24;

export type SessionPayload = {
  sub: number;
  name: string;
  username: string;
  role: string;
  pages: string[];
  driverId: number | null;
  driverName: string | null;
  exp: number;
};

function secret(): string {
  const value = process.env.APP_JWT_SECRET;
  if (!value) throw new Error('APP_JWT_SECRET is not set');
  return value;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return bytesToBase64Url(new Uint8Array(signature));
}

function signaturesMatch(actual: string, expected: string): boolean {
  const a = base64UrlToBytes(actual);
  const b = base64UrlToBytes(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signSession(input: Omit<SessionPayload, 'exp'>): Promise<string> {
  const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({
    ...input,
    exp: Math.floor(Date.now() / 1000) + SESSION_HOURS * 60 * 60,
  })));
  const signature = await hmac(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return null;
  try {
    const expected = await hmac(`${header}.${payload}`);
    if (!signaturesMatch(signature, expected)) return null;
    const body = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as SessionPayload;
    if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null;
    if (!Array.isArray(body.pages)) body.pages = [];
    return body;
  } catch {
    return null;
  }
}
