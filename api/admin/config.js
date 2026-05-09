import { requireAdmin } from '../../lib/admin-auth.js';
import {
  getActiveModel, setActiveModel,
  getTonePrompt, setTonePrompt, clearTonePrompt,
  getGuard, setGuard, getAllGuards,
  ALLOWED_MODELS, TONES, GUARDS,
} from '../../lib/config.js';
import { logAdminAction } from '../../lib/audit.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return getCfg(req, res);
  if (req.method === 'POST') return postCfg(req, res);
  return res.status(405).json({ ok: false, error: 'use GET or POST.', code: 'METHOD_NOT_ALLOWED' });
}

async function buildSnapshot() {
  const [activeModel, gentle, honest, brutal, guards] = await Promise.all([
    getActiveModel(),
    getTonePrompt('gentle'),
    getTonePrompt('honest'),
    getTonePrompt('brutal'),
    getAllGuards(),
  ]);
  return {
    activeModel,
    tonePrompts: {
      gentle: { source: gentle.source, content: gentle.content, version: gentle.version },
      honest: { source: honest.source, content: honest.content, version: honest.version },
      brutal: { source: brutal.source, content: brutal.content, version: brutal.version },
    },
    guards,
  };
}

async function getCfg(req, res) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    if (auth.status === 403) {
      await logAdminAction({
        userId: auth.userId, email: auth.email,
        action: 'admin_config_get', allowed: false,
        fields: { reason: auth.code },
      });
    }
    return res.status(auth.status).json({ ok: false, error: auth.error, code: auth.code });
  }
  return res.status(200).json({ ok: true, data: await buildSnapshot() });
}

async function postCfg(req, res) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    if (auth.status === 403) {
      await logAdminAction({
        userId: auth.userId, email: auth.email,
        action: 'admin_config_post', allowed: false,
        fields: { reason: auth.code },
      });
    }
    return res.status(auth.status).json({ ok: false, error: auth.error, code: auth.code });
  }

  const body = req.body || {};

  // activeModel
  if (typeof body.activeModel === 'string') {
    if (!ALLOWED_MODELS.includes(body.activeModel)) {
      return res.status(400).json({ ok: false, error: 'unsupported model.', code: 'INVALID_MODEL' });
    }
    const before = await getActiveModel();
    if (before !== body.activeModel) {
      await setActiveModel(body.activeModel);
      await logAdminAction({
        userId: auth.userId, email: auth.email,
        action: 'model_changed', allowed: true,
        fields: { from: before, to: body.activeModel },
      });
    }
  }

  // tonePrompts: { gentle?: string|null, honest?: string|null, brutal?: string|null }
  if (body.tonePrompts && typeof body.tonePrompts === 'object') {
    for (const tone of TONES) {
      if (!(tone in body.tonePrompts)) continue;
      const v = body.tonePrompts[tone];
      const before = await getTonePrompt(tone);

      if (v === null) {
        if (before.source === 'redis') {
          await clearTonePrompt(tone);
          await logAdminAction({
            userId: auth.userId, email: auth.email,
            action: 'tone_prompt_reverted', allowed: true,
            fields: { tone, before: before.content },
          });
        }
        continue;
      }

      if (typeof v === 'string') {
        if (v.length < 20 || v.length > 20000) {
          return res.status(400).json({ ok: false, error: 'tone prompt must be 20–20000 chars.', code: 'INVALID_TONE_CONTENT' });
        }
        if (v !== before.content) {
          await setTonePrompt(tone, v);
          await logAdminAction({
            userId: auth.userId, email: auth.email,
            action: 'tone_prompt_edited', allowed: true,
            fields: { tone, before: before.content, after: v },
          });
        }
      }
    }
  }

  // guards
  if (body.guards && typeof body.guards === 'object') {
    for (const g of GUARDS) {
      if (!(g in body.guards)) continue;
      const v = body.guards[g];
      if (!['on', 'off'].includes(v)) {
        return res.status(400).json({ ok: false, error: 'guard value must be on or off.', code: 'INVALID_GUARD_VALUE' });
      }
      const before = await getGuard(g);
      if (before !== v) {
        await setGuard(g, v);
        await logAdminAction({
          userId: auth.userId, email: auth.email,
          action: 'guard_toggled', allowed: true,
          fields: { guard: g, from: before, to: v },
        });
      }
    }
  }

  return res.status(200).json({ ok: true, data: await buildSnapshot() });
}
