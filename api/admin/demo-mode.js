import { requireAdmin } from '../../lib/admin-auth.js';
import { redisGet, redisSet } from '../../lib/redis.js';
import { getRecentFailures } from '../../lib/circuit.js';
import { logAdminAction } from '../../lib/audit.js';

const KEY = 'config:demo_mode_forced';

export default async function handler(req, res) {
  if (req.method === 'GET') return getState(req, res);
  if (req.method === 'POST') return postState(req, res);
  return res.status(405).json({ ok: false, error: 'use GET or POST.', code: 'METHOD_NOT_ALLOWED' });
}

async function getState(req, res) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    if (auth.status === 403) {
      await logAdminAction({
        userId: auth.userId, email: auth.email,
        action: 'admin_demo_mode_get', allowed: false,
        fields: { reason: auth.code },
      });
    }
    return res.status(auth.status).json({ ok: false, error: auth.error, code: auth.code });
  }

  let enabled = false;
  try { enabled = (await redisGet(KEY)) === 'on'; } catch {}
  const recentFailures = await getRecentFailures();
  return res.status(200).json({ ok: true, data: { enabled, recentFailures } });
}

async function postState(req, res) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    if (auth.status === 403) {
      await logAdminAction({
        userId: auth.userId, email: auth.email,
        action: 'admin_demo_mode_post', allowed: false,
        fields: { reason: auth.code },
      });
    }
    return res.status(auth.status).json({ ok: false, error: auth.error, code: auth.code });
  }

  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'enabled must be true or false.', code: 'INVALID_VALUE' });
  }

  let before = false;
  try { before = (await redisGet(KEY)) === 'on'; } catch {}
  const after = enabled;
  if (before !== after) {
    await redisSet(KEY, after ? 'on' : 'off');
    await logAdminAction({
      userId: auth.userId, email: auth.email,
      action: 'demo_mode_toggled', allowed: true,
      fields: { from: before ? 'on' : 'off', to: after ? 'on' : 'off' },
    });
  }

  const recentFailures = await getRecentFailures();
  return res.status(200).json({ ok: true, data: { enabled: after, recentFailures } });
}
