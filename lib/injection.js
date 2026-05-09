// High-confidence prompt-injection patterns. Soft-warn only — we don't block
// the roast on a hit; we just nudge the model to stay in persona (Phase 5).
// False positives on legit resumes (e.g. "operating system: Linux") are
// expected and acceptable — the cost is one extra system-prompt sentence,
// not a user-facing error.
export const INJECTION_PATTERNS = [
  { name: 'ignore_previous',   re: /\n\s*ignore\s+(all\s+)?previous\s+(instructions|messages)/i },
  { name: 'system_marker',     re: /\bsystem\s*[:=]/i },
  { name: 'assistant_marker',  re: /\bassistant\s*[:=]/i },
  { name: 'disregard',         re: /\n\s*disregard\s+/i },
  { name: 'system_brackets',   re: /\[SYSTEM\]/i },
];

// Returns the name of the first matching pattern, or null. We deliberately do
// NOT return the surrounding text — only the pattern name lands in logs, per
// the privacy spine.
export function scanForInjection(text) {
  if (typeof text !== 'string' || !text) return null;
  for (const { name, re } of INJECTION_PATTERNS) {
    if (re.test(text)) return name;
  }
  return null;
}
