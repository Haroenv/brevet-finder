export function stableHash(input: string) {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function countByKey(keys: string[]) {
  const counts = new Map<string, number>();
  keys.forEach((key) => {
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

export function makeCollisionSafeObjectID(
  baseObjectID: string,
  counts: Map<string, number>,
  salt: string
) {
  return (counts.get(baseObjectID) || 0) > 1
    ? `${baseObjectID}__${stableHash(salt.toLowerCase())}`
    : baseObjectID;
}
