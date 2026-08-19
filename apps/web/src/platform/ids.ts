export function createId<T extends string>(): T {
  return crypto.randomUUID() as T;
}

export function nowIso() {
  return new Date().toISOString();
}

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "item";
}
