import { getAllGuards } from '../lib/config.js';
import { log } from '../lib/log.js';

// Public endpoint — guard state only. No auth required, no secrets exposed.
// The frontend uses this to give immediate UX feedback (e.g. refuse a 6mb pdf
// before extraction); the server is still the real gate inside /api/roast.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false, error: 'use GET.', code: 'METHOD_NOT_ALLOWED',
    });
  }

  try {
    const guards = await getAllGuards();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, data: { guards } });
  } catch (err) {
    log('config_public_failed', {
      status: 'error',
      errorType: err?.message || 'unknown',
    });
    return res.status(500).json({
      ok: false,
      error: 'something went wrong, try refreshing.',
      code: 'CONFIG_FETCH_FAILED',
    });
  }
}
