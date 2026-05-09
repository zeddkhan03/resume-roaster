import { verifyToken } from '@clerk/backend';
import { redisGet, utcDateKey, nextUtcMidnight, DAILY_QUOTA_TOKENS } from '../lib/redis.js';
import { log } from '../lib/log.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false, error: 'use GET.', code: 'METHOD_NOT_ALLOWED',
    });
  }

  let userId;
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) throw new Error('missing_bearer');
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    userId = claims.sub;
    if (!userId) throw new Error('missing_sub');
  } catch (err) {
    log('auth_failed', {
      status: 'denied',
      route: '/api/usage',
      reason: err?.code || err?.name || err?.message || 'unknown',
    });
    return res.status(401).json({
      ok: false,
      error: 'please sign in to continue',
      code: 'UNAUTHORIZED',
    });
  }

  const key = utcDateKey(userId);
  let used = 0;
  try {
    const got = await redisGet(key);
    used = Number(got) || 0;
  } catch (err) {
    // Fail-open: report 0 used so the demo doesn't break on Redis hiccups.
    log('usage_redis_error', {
      status: 'error',
      route: '/api/usage',
      errorType: err?.message || 'unknown',
    });
  }

  const limit = DAILY_QUOTA_TOKENS;
  const percentUsed = Math.min(100, Math.round((used / limit) * 100));
  const resetsAt = nextUtcMidnight().toISOString();
  log('usage_check', { status: 'success', userId, used, limit });
  return res.status(200).json({
    ok: true,
    data: { used, limit, percentUsed, resetsAt },
  });
}
