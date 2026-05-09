import { requireAdmin } from '../../lib/admin-auth.js';
import { redisXRevRange } from '../../lib/redis.js';
import { logAdminAction } from '../../lib/audit.js';
import { log } from '../../lib/log.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'use GET.', code: 'METHOD_NOT_ALLOWED' });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    if (auth.status === 403) {
      await logAdminAction({
        userId: auth.userId, email: auth.email,
        action: 'admin_log_get', allowed: false,
        fields: { reason: auth.code },
      });
    }
    return res.status(auth.status).json({ ok: false, error: auth.error, code: auth.code });
  }

  let raw = [];
  try {
    raw = (await redisXRevRange('admin:actions', '+', '-', 20)) || [];
  } catch (err) {
    log('audit_read_failed', {
      status: 'error',
      errorType: err?.message || 'unknown',
    });
    return res.status(200).json({ ok: true, data: { entries: [] } });
  }

  const entries = (raw || []).map((entry) => {
    const id = entry?.[0];
    const arr = entry?.[1] || [];
    const fields = {};
    for (let i = 0; i < arr.length; i += 2) fields[arr[i]] = arr[i + 1];
    let parsedFields = {};
    try { parsedFields = JSON.parse(fields.fields || '{}'); } catch {}
    return {
      id,
      ts: fields.ts || '',
      userId: fields.userId || '',
      email: fields.email || '',
      action: fields.action || '',
      allowed: fields.allowed === 'true',
      fields: parsedFields,
    };
  });

  return res.status(200).json({ ok: true, data: { entries } });
}
