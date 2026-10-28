const TTL_MS = 20_000;
const seen = new Map<string, number>();

function sweep(now: number) {
  for (const [id, at] of seen) {
    if (now - at > TTL_MS) seen.delete(id);
  }
  return seen.size;
}

export function touchPresence(id: string, leave = false) {
  const now = Date.now();
  if (!/^[\w-]{8,80}$/.test(id)) return sweep(now);
  if (leave) seen.delete(id);
  else seen.set(id, now);
  return sweep(now);
}
