import { redisXAdd } from './redis.js';
import { log } from './log.js';

// Two-track audit: every admin action lands in (a) the `admin:actions` Redis
// stream (admin-dashboard-facing, MAXLEN ~ 1000), and (b) the structured log
// stream as an `admin_action` event (Vercel-logs-facing, durable beyond the
// stream's bounded window). Admin's own email IS recorded in both — operator
// self-identification per the carve-out in CLAUDE.md §"Logging" and SPEC §Privacy.
// End-user identifiers in `fields` use opaque userId only.
export async function logAdminAction({ userId, email, action, allowed, fields }) {
  // Log first — a stream-write failure shouldn't lose the structured line.
  log('admin_action', {
    userId: userId || 'anonymous',
    email: email || '',
    action: action || 'unknown',
    status: allowed ? 'success' : 'denied',
    ...(fields || {}),
  });

  try {
    await redisXAdd('admin:actions', {
      ts: new Date().toISOString(),
      userId: userId || 'anonymous',
      email: email || '',
      action: action || 'unknown',
      allowed: String(!!allowed),
      fields: JSON.stringify(fields || {}),
    });
  } catch (err) {
    log('audit_write_failed', {
      status: 'error',
      action,
      errorType: err?.message || 'unknown',
    });
  }
}
