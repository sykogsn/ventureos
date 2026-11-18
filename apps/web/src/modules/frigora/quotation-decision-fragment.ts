/** Reads the bearer secret from a URL fragment. The fragment is not part of the HTTP request. */
export function readDecisionFragment(hash: string) {
  if (!hash.startsWith("#") || hash.length < 2) {
    return "";
  }
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return "";
  }
}

export function decisionPagePath(pathname: string, search: string) {
  return `${pathname}${search}`;
}

export type DecisionFragmentStore = {
  get(grantId: string): string | undefined;
  set(grantId: string, secret: string): void;
};

const fragmentMemory = Symbol.for("frigora.quotationDecisionFragment");

type FragmentHost = {
  [fragmentMemory]?: DecisionFragmentStore;
};

export function createDecisionFragmentStore(): DecisionFragmentStore {
  const values = new Map<string, string>();
  return {
    get(grantId) {
      return values.get(grantId);
    },
    set(grantId, secret) {
      if (grantId && secret) values.set(grantId, secret);
    },
  };
}

/** Page memory only. A reload starts empty, and the secret is not written to storage. */
export function browserDecisionFragmentStore(
  target: FragmentHost = window as unknown as FragmentHost,
): DecisionFragmentStore {
  if (!target[fragmentMemory]) target[fragmentMemory] = createDecisionFragmentStore();
  return target[fragmentMemory];
}

export function grantIdFromDecisionPath(pathname: string) {
  const match = pathname.match(/\/quotation-decision\/([^/]+)$/);
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

/**
 * Keeps the first readable fragment for a grant. A later startup pass sees an
 * empty address-bar fragment after replaceState and must still return the
 * captured bearer. An empty read does not replace a captured value.
 */
export function retainDecisionFragment(grantId: string, hash: string, store: DecisionFragmentStore) {
  const fromHash = readDecisionFragment(hash);
  if (fromHash) {
    store.set(grantId, fromHash);
    return fromHash;
  }
  return store.get(grantId) ?? "";
}

export function rememberDecisionFragment(
  location: { pathname: string; hash: string },
  store: DecisionFragmentStore,
) {
  const grantId = grantIdFromDecisionPath(location.pathname);
  if (!grantId) return "";
  return retainDecisionFragment(grantId, location.hash, store);
}

/** One startup result per key. The key must not contain the bearer. */
export function createStartupFlight() {
  const flights = new Map<string, Promise<unknown>>();
  return function startFlight<T>(key: string, start: () => Promise<T>): Promise<T> {
    const existing = flights.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const created = start();
    flights.set(key, created);
    return created;
  };
}
