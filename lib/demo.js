import { redisGet } from './redis.js';
import { isOpen as circuitIsOpen } from './circuit.js';
import { DEMO_ROASTS } from './demo-roasts.js';

const TONES = ['gentle', 'honest', 'brutal'];
const CHUNK_SIZE = 80;
const CHUNK_DELAY_MS = 12;

// Three-source priority: query param → admin toggle → circuit breaker.
// Returns { from, reason, tone } on cache-hit, null on miss.
export async function shouldServeFromCache(req, bodyTone) {
  const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
  const queryDemo = url.searchParams.get('demo');
  if (queryDemo && TONES.includes(queryDemo)) {
    return { from: 'query', reason: 'query', tone: queryDemo };
  }

  try {
    const flag = await redisGet('config:demo_mode_forced');
    if (flag === 'on') {
      return { from: 'admin', reason: 'admin', tone: bodyTone };
    }
  } catch {}

  if (await circuitIsOpen()) {
    return { from: 'circuit', reason: 'circuit_open', tone: bodyTone };
  }

  return null;
}

export function getCachedRoast(tone) {
  return DEMO_ROASTS[tone] || DEMO_ROASTS.honest;
}

// Stream a cached body in small chunks with realistic pacing — token-by-token
// look without the OpenAI cost. ~250-400ms total for a 2000-char roast.
export async function streamCachedRoast(res, body) {
  for (let i = 0; i < body.length; i += CHUNK_SIZE) {
    res.write(body.slice(i, i + CHUNK_SIZE));
    await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
  }
}
