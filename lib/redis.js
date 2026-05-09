// Tiny Upstash REST wrapper. No SDK — keeps the external-libs allowlist clean.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const DAILY_QUOTA_TOKENS = 30000;
export const DAY_SECONDS = 24 * 60 * 60;

async function command(parts) {
  if (!REDIS_URL || !TOKEN) throw new Error('redis_not_configured');
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(parts),
  });
  if (!res.ok) throw new Error(`redis_http_${res.status}`);
  const json = await res.json();
  return json.result;
}

export async function redisGet(key) {
  return command(['GET', key]);
}

export async function redisSet(key, value) {
  return command(['SET', key, String(value)]);
}

export async function redisDel(key) {
  return command(['DEL', key]);
}

export async function redisIncrBy(key, amount) {
  const v = await command(['INCRBY', key, String(amount)]);
  return Number(v);
}

export async function redisExpire(key, seconds) {
  return command(['EXPIRE', key, String(seconds)]);
}

export async function redisMget(...keys) {
  if (!keys.length) return [];
  return command(['MGET', ...keys]);
}

// Returns [newCursor, [keys]]. Caller iterates until newCursor === '0'.
export async function redisScan(cursor, matchPattern, count = 100) {
  return command(['SCAN', String(cursor), 'MATCH', matchPattern, 'COUNT', String(count)]);
}

// fields is a plain object {k: v}. Caps stream at ~1000 entries.
export async function redisXAdd(stream, fields) {
  const flat = [];
  for (const [k, v] of Object.entries(fields)) flat.push(k, String(v));
  return command(['XADD', stream, 'MAXLEN', '~', '1000', '*', ...flat]);
}

// Returns array of [id, [k, v, k, v, ...]] entries, newest first.
export async function redisXRevRange(stream, end = '+', start = '-', count = 20) {
  return command(['XREVRANGE', stream, end, start, 'COUNT', String(count)]);
}

// Quota key uses UTC date so it auto-rolls at 00:00 UTC regardless of TTL.
export function utcDateKey(userId, now = new Date()) {
  const d = now.toISOString().slice(0, 10);
  return `usage:${userId}:${d}`;
}

export function utcDateString(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function nextUtcMidnight(now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
