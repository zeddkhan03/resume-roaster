import { requireAdmin, clerkClient } from '../../lib/admin-auth.js';
import { redisScan, redisMget, utcDateString } from '../../lib/redis.js';
import { getActiveModel, COST_PER_1M } from '../../lib/config.js';
import { logAdminAction } from '../../lib/audit.js';

const TOP_N = 50;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'use GET.', code: 'METHOD_NOT_ALLOWED' });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    if (auth.status === 403) {
      await logAdminAction({
        userId: auth.userId, email: auth.email,
        action: 'admin_usage_get', allowed: false,
        fields: { reason: auth.code },
      });
    }
    return res.status(auth.status).json({ ok: false, error: auth.error, code: auth.code });
  }

  const today = utcDateString();
  const activeModel = await getActiveModel();
  const costRate = COST_PER_1M[activeModel] ?? 0.30;

  // SCAN for usage:*:today keys.
  const usageKeys = [];
  let cursor = '0';
  for (let i = 0; i < 50; i++) {
    const result = await redisScan(cursor, `usage:*:${today}`, 200);
    cursor = String(result?.[0] ?? '0');
    usageKeys.push(...(result?.[1] || []));
    if (cursor === '0' || usageKeys.length > 1000) break;
  }

  let totalUsers = 0;
  let totalTokens = 0;
  let perUser = [];

  if (usageKeys.length) {
    const tokens = await redisMget(...usageKeys);
    const records = usageKeys.map((k, i) => {
      const userId = k.split(':')[1];
      return { userId, tokensUsed: Number(tokens?.[i]) || 0 };
    }).filter((r) => r.userId);

    totalUsers = records.length;
    totalTokens = records.reduce((s, r) => s + r.tokensUsed, 0);
    records.sort((a, b) => b.tokensUsed - a.tokensUsed);
    const top = records.slice(0, TOP_N);

    const ck = clerkClient();
    const users = await Promise.all(
      top.map((r) => ck.users.getUser(r.userId).catch(() => null))
    );

    const overrideKeys = top.map((r) => `quota:override:${r.userId}:${today}`);
    const overrides = overrideKeys.length ? await redisMget(...overrideKeys) : [];

    perUser = top.map((r, i) => {
      const u = users[i];
      const override = overrides?.[i] ? Number(overrides[i]) : null;
      const email =
        u?.emailAddresses?.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ||
        u?.emailAddresses?.[0]?.emailAddress ||
        '';
      return {
        userId: r.userId,
        firstName: u?.firstName || '',
        lastInitial: (u?.lastName || '').slice(0, 1).toUpperCase(),
        email,
        tokensUsed: r.tokensUsed,
        costEstimate: round3((r.tokensUsed / 1_000_000) * costRate),
        quotaOverride: override,
      };
    });
  }

  return res.status(200).json({
    ok: true,
    data: {
      todayLoad: {
        totalUsers,
        totalTokens,
        estCostUsd: round3((totalTokens / 1_000_000) * costRate),
        activeModel,
      },
      perUser,
    },
  });
}

function round3(n) { return Math.round(n * 1000) / 1000; }
