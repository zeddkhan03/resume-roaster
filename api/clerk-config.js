// Returns the Clerk publishable key for the frontend SDK.
// Publishable by design — safe to expose. Lives in /api/ so it reads from
// process.env at request time (no build-step inlining).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false, error: 'use GET.', code: 'METHOD_NOT_ALLOWED',
    });
  }

  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return res.status(500).json({
      ok: false,
      error: 'auth is not configured. try again in a moment?',
      code: 'CONFIG_MISSING',
    });
  }

  return res.status(200).json({
    ok: true,
    data: { publishableKey },
  });
}
