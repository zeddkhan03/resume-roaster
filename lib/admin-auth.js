import { verifyToken, createClerkClient } from '@clerk/backend';

let _clerk;
function clerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  return _clerk;
}

// Per THREAT-MODEL §A07: NFC + lowercase + trim before allowlist match.
function normaliseEmail(e) {
  return (e || '').trim().toLowerCase().normalize('NFC');
}

// Returns either { ok: true, userId, email, firstName, lastName }
// or         { ok: false, status, code, error, userId?, email? } for 401/403/500.
export async function requireAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', error: 'please sign in to continue' };
  }

  let userId;
  try {
    const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    userId = claims.sub;
    if (!userId) throw new Error('missing_sub');
  } catch {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', error: 'please sign in to continue' };
  }

  let user;
  try {
    user = await clerk().users.getUser(userId);
  } catch {
    return { ok: false, status: 500, code: 'CLERK_LOOKUP_FAILED', error: 'auth check failed. try again?' };
  }

  const primaryEmail =
    user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ||
    user.emailAddresses?.[0]?.emailAddress ||
    '';
  const adminEmail = normaliseEmail(process.env.ADMIN_EMAIL);
  const userEmail = normaliseEmail(primaryEmail);

  if (!adminEmail || !userEmail || userEmail !== adminEmail) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      error: 'admin only',
      userId,
      email: primaryEmail,
    };
  }

  return {
    ok: true,
    userId,
    email: primaryEmail,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
  };
}

export { clerk as clerkClient };
