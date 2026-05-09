import { requireAdmin } from '../../lib/admin-auth.js';
import { setQuotaOverride, resetUsage } from '../../lib/config.js';
import { utcDateString } from '../../lib/redis.js';
import { logAdminAction } from '../../lib/audit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'use POST.', code: 'METHOD_NOT_ALLOWED' });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    if (auth.status === 403) {
      await logAdminAction({
        userId: auth.userId, email: auth.email,
        action: 'admin_quota_post', allowed: false,
        fields: { reason: auth.code },
      });
    }
    return res.status(auth.status).json({ ok: false, error: auth.error, code: auth.code });
  }

  const { userId, action, value } = req.body || {};
  if (typeof userId !== 'string' || !userId) {
    return res.status(400).json({ ok: false, error: 'userId required.', code: 'INVALID_USER_ID' });
  }
  // Audit #043 / F3 — userId is admin-supplied and surfaces in the audit-log
  // render via innerHTML; constrain to Clerk's userId shape so injection bait
  // can never reach the DOM.
  if (!/^user_[A-Za-z0-9]{8,40}$/.test(userId)) {
    return res.status(400).json({ ok: false, error: 'userId must match Clerk userId shape.', code: 'INVALID_USER_ID' });
  }
  if (!['set', 'reset'].includes(action)) {
    return res.status(400).json({ ok: false, error: 'action must be set or reset.', code: 'INVALID_ACTION' });
  }

  const today = utcDateString();

  if (action === 'set') {
    if (!Number.isFinite(value) || value < 0 || value > 10_000_000) {
      return res.status(400).json({ ok: false, error: 'value must be 0–10000000.', code: 'INVALID_VALUE' });
    }
    await setQuotaOverride(userId, today, value);
    await logAdminAction({
      userId: auth.userId, email: auth.email,
      action: 'quota_set', allowed: true,
      fields: { targetUserId: userId, value: Math.floor(value) },
    });
    return res.status(200).json({ ok: true, data: { userId, action: 'set', value: Math.floor(value) } });
  }

  await resetUsage(userId, today);
  await logAdminAction({
    userId: auth.userId, email: auth.email,
    action: 'quota_reset', allowed: true,
    fields: { targetUserId: userId },
  });
  return res.status(200).json({ ok: true, data: { userId, action: 'reset' } });
}
