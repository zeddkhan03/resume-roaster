import { redisGet, redisIncrBy, redisExpire } from './redis.js';

// Sliding-ish window via single-key INCR + EXPIRE. The first failure sets a
// 60s TTL; subsequent failures within that window increment the same key.
// Once the key expires, the counter resets — so a 4th failure 90s after the
// first won't keep the circuit open. Threshold and window match PLAN DoD #3.
const KEY = 'circuit:openai:5xx';
const WINDOW_SECONDS = 60;
const THRESHOLD = 3;

export async function recordUpstream5xx() {
  try {
    const count = await redisIncrBy(KEY, 1);
    if (count === 1) await redisExpire(KEY, WINDOW_SECONDS);
    return count;
  } catch {
    return 0;
  }
}

export async function isOpen() {
  try {
    const v = await redisGet(KEY);
    return Number(v) >= THRESHOLD;
  } catch {
    return false;
  }
}

export async function getRecentFailures() {
  try {
    const v = await redisGet(KEY);
    return Number(v) || 0;
  } catch {
    return 0;
  }
}
