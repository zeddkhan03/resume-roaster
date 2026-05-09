// Single structured-log helper. Every server-side log line in this project
// goes through here. Discipline rules — what NEVER to log — live in CLAUDE.md
// §"Logging conventions"; this helper trusts callers to follow them.
export function log(event, fields = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...fields,
  }));
}
