import { GENTLE, HONEST, BRUTAL, BASE_INSTRUCTIONS, PROMPT_VERSION } from '../lib/prompts.js';

const PERSONAS = { gentle: GENTLE, honest: HONEST, brutal: BRUTAL };
const ALLOWED_TONES = ['gentle', 'honest', 'brutal'];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'use GET.', code: 'METHOD_NOT_ALLOWED' });
  }
  const tone = (req.query?.tone || '').toLowerCase();
  if (!ALLOWED_TONES.includes(tone)) {
    return res.status(400).json({
      ok: false, error: 'pick a valid tone (gentle, honest, brutal).', code: 'INVALID_TONE',
    });
  }
  return res.status(200).json({
    ok: true,
    data: {
      tone,
      version: PROMPT_VERSION,
      persona: PERSONAS[tone],
      base: BASE_INSTRUCTIONS,
    },
  });
}
