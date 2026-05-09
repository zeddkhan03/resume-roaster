import { redisGet, redisSet, redisDel } from './redis.js';
import { GENTLE, HONEST, BRUTAL, PROMPT_VERSION } from './prompts.js';

export const DEFAULT_MODEL = 'gpt-5.4-mini';
export const ALLOWED_MODELS = ['gpt-5.4-mini', 'gpt-4o'];
export const TONES = ['gentle', 'honest', 'brutal'];
export const GUARDS = ['filesize', 'injection', 'output'];

const FILE_TONE = { gentle: GENTLE, honest: HONEST, brutal: BRUTAL };

// Approximate blended cost rates per 1M tokens. Display only — not for billing.
export const COST_PER_1M = {
  'gpt-5.4-mini': 0.30,
  'gpt-4o': 2.50,
};

export async function getActiveModel() {
  try {
    const v = await redisGet('config:active_model');
    if (v && ALLOWED_MODELS.includes(v)) return v;
  } catch {}
  return DEFAULT_MODEL;
}

export async function setActiveModel(model) {
  if (!ALLOWED_MODELS.includes(model)) throw new Error('invalid_model');
  return redisSet('config:active_model', model);
}

export async function getTonePrompt(tone) {
  if (!TONES.includes(tone)) throw new Error('invalid_tone');
  try {
    const v = await redisGet(`config:tone:${tone}`);
    if (v) return { content: v, source: 'redis', version: PROMPT_VERSION };
  } catch {}
  return { content: FILE_TONE[tone], source: 'file', version: PROMPT_VERSION };
}

export async function setTonePrompt(tone, content) {
  if (!TONES.includes(tone)) throw new Error('invalid_tone');
  if (typeof content !== 'string' || content.length < 20 || content.length > 20000) {
    throw new Error('invalid_content');
  }
  return redisSet(`config:tone:${tone}`, content);
}

export async function clearTonePrompt(tone) {
  if (!TONES.includes(tone)) throw new Error('invalid_tone');
  return redisDel(`config:tone:${tone}`);
}

export async function getGuard(name) {
  if (!GUARDS.includes(name)) throw new Error('invalid_guard');
  try {
    const v = await redisGet(`config:guard:${name}`);
    if (v === 'off') return 'off';
  } catch {}
  return 'on'; // default on, fail-closed (safer)
}

export async function setGuard(name, value) {
  if (!GUARDS.includes(name)) throw new Error('invalid_guard');
  if (!['on', 'off'].includes(value)) throw new Error('invalid_value');
  return redisSet(`config:guard:${name}`, value);
}

export async function getAllGuards() {
  const out = {};
  await Promise.all(GUARDS.map(async (g) => { out[g] = await getGuard(g); }));
  return out;
}

export async function getQuotaOverride(userId, dateStr) {
  try {
    const v = await redisGet(`quota:override:${userId}:${dateStr}`);
    if (v) return Number(v);
  } catch {}
  return null;
}

export async function setQuotaOverride(userId, dateStr, value) {
  if (!Number.isFinite(value) || value < 0 || value > 10_000_000) throw new Error('invalid_quota');
  return redisSet(`quota:override:${userId}:${dateStr}`, String(Math.floor(value)));
}

export async function resetUsage(userId, dateStr) {
  return redisDel(`usage:${userId}:${dateStr}`);
}
