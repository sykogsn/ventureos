import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { act } from "react";
import { formatQuotationMoney } from "./quotation-decision-contract";

const GRANT_ID = "grant-expired-marker-91";
const SECRET = "bearer-expired-marker-91";
const MARKERS = [
  "EXPIRED-DESCRIPTION-MARKER",
  "EXPIRED-CUSTOMER-MARKER",
  "EXPIRED-SITE-MARKER",
  "424242",
  "111111",
  "222222",
  "333333",
];

type ActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

function markReactActEnvironment() {
  (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = true;
}

type MiniListener = {
  type: string;
  callback: (event: MiniDispatchEvent) => void;
  capture: boolean;
};

class MiniDispatchEvent {
  button = 0;
  bubbles = true;
  cancelable = true;
  defaultPrevented = false;
  eventPhase = 0;
  timeStamp = 0;
  isTrusted = false;
  detail = 1;
  currentTarget: MiniNode | null = null;
  private stopped = false;

  constructor(
    readonly type: string,
    readonly target: MiniNode,
  ) {}

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this.stopped = true;
  }

  get propagationStopped() {
    return this.stopped;
  }
}

class MiniNode {
  parentNode: MiniNode | null = null;
  childNodes: MiniNode[] = [];
  ownerDocument: MiniDocument | null = null;
  nodeValue: string | null = null;
  private listeners: MiniListener[] = [];

  constructor(
    readonly nodeType: number,
    readonly nodeName: string,
  ) {}

  get firstChild(): MiniNode | null {
    return this.childNodes[0] ?? null;
  }

  get nextSibling(): MiniNode | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[index + 1] ?? null;
  }

  get textContent() {
    if (this.nodeType === 3 || this.nodeType === 8) return this.nodeValue ?? "";
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    if (this.nodeType !== 1) {
      this.nodeValue = value;
      return;
    }
    this.childNodes = [];
    if (!this.ownerDocument) return;
    const text = this.ownerDocument.createTextNode(value);
    text.parentNode = this;
    this.childNodes.push(text);
  }

  insertBefore(child: MiniNode, before: MiniNode | null) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    const index = before ? this.childNodes.indexOf(before) : -1;
    if (index < 0) this.childNodes.push(child);
    else this.childNodes.splice(index, 0, child);
    return child;
  }

  appendChild(child: MiniNode) {
    return this.insertBefore(child, null);
  }

  removeChild(child: MiniNode) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  contains(other: MiniNode | null) {
    let current = other;
    while (current) {
      if (current === this) return true;
      current = current.parentNode;
    }
    return false;
  }

  addEventListener(
    type: string,
    callback: (event: MiniDispatchEvent) => void,
    options?: boolean | { capture?: boolean },
  ) {
    if (typeof callback !== "function") return;
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    this.listeners.push({ type, callback, capture });
  }

  removeEventListener() {}

  dispatch(type: string) {
    const event = new MiniDispatchEvent(type, this);
    const path: MiniNode[] = [this];
    let current: MiniNode | null = this.parentNode;
    while (current) {
      path.push(current);
      current = current.parentNode;
    }
    for (let index = path.length - 1; index >= 0; index -= 1) {
      const node = path[index];
      if (!node) continue;
      event.currentTarget = node;
      for (const listener of [...node.listeners]) {
        if (listener.type === type && listener.capture) listener.callback(event);
      }
      if (event.propagationStopped) return;
    }
    for (const node of path) {
      event.currentTarget = node;
      for (const listener of [...node.listeners]) {
        if (listener.type === type && !listener.capture) listener.callback(event);
      }
      if (event.propagationStopped) return;
    }
  }
}

type MiniStyle = {
  setProperty: (name: string, value: string) => void;
  [name: string]: string | ((name: string, value: string) => void);
};

class MiniElement extends MiniNode {
  namespaceURI = "http://www.w3.org/1999/xhtml";
  style: MiniStyle = {
    setProperty: (name: string, value: string) => {
      this.style[name] = value;
    },
  };

  get tagName() {
    return this.nodeName;
  }
  private attributes = new Map<string, string>();
  private classValue = "";

  constructor(name: string, ownerDocument: MiniDocument) {
    super(1, name.toUpperCase());
    this.ownerDocument = ownerDocument;
  }

  get className() {
    return this.classValue;
  }

  set className(value: string) {
    this.classValue = String(value);
    this.attributes.set("class", this.classValue);
  }

  setAttribute(name: string, value: string) {
    if (name === "class") this.classValue = String(value);
    this.attributes.set(name, String(value));
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
    if (name === "class") this.classValue = "";
  }

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
}

class MiniDocument extends MiniNode {
  documentElement: MiniElement;
  body: MiniElement;
  head: MiniElement;
  defaultView: object | null = null;

  constructor() {
    super(9, "#document");
    this.ownerDocument = this;
    this.documentElement = new MiniElement("html", this);
    this.head = new MiniElement("head", this);
    this.body = new MiniElement("body", this);
    this.appendChild(this.documentElement);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }

  createElement(name: string) {
    return new MiniElement(name, this);
  }

  createElementNS(_namespace: string, name: string) {
    return this.createElement(name);
  }

  createTextNode(text: string) {
    const node = new MiniNode(3, "#text");
    node.ownerDocument = this;
    node.nodeValue = text;
    return node;
  }

  createComment(text: string) {
    const node = new MiniNode(8, "#comment");
    node.ownerDocument = this;
    node.nodeValue = text;
    return node;
  }
}

function buttonText(node: MiniNode): string[] {
  const labels: string[] = [];
  if (node.nodeName === "BUTTON") labels.push(node.textContent);
  for (const child of node.childNodes) labels.push(...buttonText(child));
  return labels;
}

function findButton(node: MiniNode, label: string): MiniElement | null {
  if (node instanceof MiniElement && node.nodeName === "BUTTON" && node.textContent === label) return node;
  for (const child of node.childNodes) {
    const found = findButton(child, label);
    if (found) return found;
  }
  return null;
}

async function renderConsumedDecision(decision: "approved" | "declined") {
  const grantId = decision === "approved" ? "grant-used-approved-marker-94" : "grant-used-declined-marker-95";
  const secret = decision === "approved" ? "bearer-used-approved-marker-94" : "bearer-used-declined-marker-95";
  const markers = decision === "approved"
    ? ["USED-APPROVED-DESCRIPTION-MARKER", "USED-APPROVED-CUSTOMER-MARKER", "USED-APPROVED-SITE-MARKER", "848484", "101010", "202020", "303030", "ZAR"]
    : ["USED-DECLINED-DESCRIPTION-MARKER", "USED-DECLINED-CUSTOMER-MARKER", "USED-DECLINED-SITE-MARKER", "858585", "404040", "505050", "606060", "ZAR"];
  const description = markers[0] ?? "";
  const customerName = markers[1] ?? "";
  const siteName = markers[2] ?? "";
  const totalMinor = decision === "approved" ? 848484 : 858585;
  const labourAmountMinor = decision === "approved" ? 101010 : 404040;
  const travelAmountMinor = decision === "approved" ? 202020 : 505050;
  const taxAmountMinor = decision === "approved" ? 303030 : 606060;
  const documentNode = new MiniDocument();
  const location = {
    pathname: `/quotation-decision/${grantId}`,
    search: "",
    hash: `#${encodeURIComponent(secret)}`,
    protocol: "http:",
    href: "http://localhost/quotation-decision",
  };
  const pageWindow = {
    document: documentNode,
    location,
    history: {
      replaceState(_state: null, _title: string, url: string) {
        location.hash = "";
        location.pathname = url;
        location.search = "";
      },
    },
    navigator: { userAgent: "node" },
    HTMLIFrameElement: class HTMLIFrameElement {},
    top: null as object | null,
    self: null as object | null,
    addEventListener() {},
    removeEventListener() {},
    fetch: null as typeof fetch | null,
  };
  pageWindow.top = pageWindow;
  pageWindow.self = pageWindow;
  documentNode.defaultView = pageWindow;
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  const calls: { url: string; action: string }[] = [];
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string };
    calls.push({ url, action: body.action ?? "" });
    return {
      ok: true,
      json: async () => ({
        state: "used",
        decision,
        version: 1,
        description,
        customerName,
        siteName,
        currency: "ZAR",
        totalMinor,
        commercial: { labourAmountMinor, travelAmountMinor, taxAmountMinor },
        grantId,
        secret,
      }),
    } as Response;
  };
  pageWindow.fetch = fetchMock;
  globalThis.window = pageWindow as unknown as Window & typeof globalThis;
  globalThis.document = documentNode as unknown as Document;
  globalThis.fetch = fetchMock;
  markReactActEnvironment();
  const container = documentNode.createElement("div");
  documentNode.body.appendChild(container);
  const { createRoot } = await import("react-dom/client");
  const { CustomerQuotationDecision } = await import("./customer-quotation-decision");
  const root = createRoot(container as unknown as Element);
  try {
    await act(async () => {
      root.render(createElement(CustomerQuotationDecision, { grantId }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    const text = container.textContent;
    const other = decision === "approved" ? "declined" : "approved";
    assert.equal(text.includes(`Version 1 was already ${decision}.`), true);
    assert.equal(text.includes(`Version 1 was already ${other}.`), false);
    assert.equal(text.includes(`Version 1 is ${decision}.`), false);
    assert.deepEqual(buttonText(container), []);
    assert.equal(text.includes("Approve"), false);
    assert.equal(text.includes("Decline"), false);
    assert.equal(text.includes("Confirm approval"), false);
    assert.equal(text.includes("Confirm decline"), false);
    for (const marker of markers) {
      assert.equal(text.includes(marker), false);
    }
    assert.equal(text.includes(grantId), false);
    assert.equal(text.includes(secret), false);
    assert.deepEqual(calls, [{ url: "/api/quotation-decision", action: "review" }]);
  } finally {
    await act(async () => {
      root.unmount();
    });
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
  }
}

async function renderUnverifiedDecision(input: {
  grantId: string;
  secret: string;
  markers: string[];
  state: "invalid" | "unavailable" | "limited";
  message: string;
  retry: boolean;
}) {
  const [description, customerName, siteName, totalText, labourText, travelText, taxText] = input.markers;
  const documentNode = new MiniDocument();
  const location = {
    pathname: `/quotation-decision/${input.grantId}`,
    search: "",
    hash: `#${encodeURIComponent(input.secret)}`,
    protocol: "http:",
    href: "http://localhost/quotation-decision",
  };
  const pageWindow = {
    document: documentNode,
    location,
    history: {
      replaceState(_state: null, _title: string, url: string) {
        location.hash = "";
        location.pathname = url;
        location.search = "";
      },
    },
    navigator: { userAgent: "node" },
    HTMLIFrameElement: class HTMLIFrameElement {},
    top: null as object | null,
    self: null as object | null,
    addEventListener() {},
    removeEventListener() {},
    fetch: null as typeof fetch | null,
  };
  pageWindow.top = pageWindow;
  pageWindow.self = pageWindow;
  documentNode.defaultView = pageWindow;
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  const calls: { url: string; action: string; carriesSecret: boolean }[] = [];
  const fetchMock: typeof fetch = async (requestInput, init) => {
    const url = String(requestInput);
    const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string; secret?: string };
    calls.push({
      url,
      action: body.action ?? "",
      carriesSecret: body.secret === input.secret,
    });
    return {
      ok: input.state !== "unavailable",
      json: async () => ({
        state: input.state,
        description,
        customerName,
        siteName,
        currency: "ZAR",
        totalMinor: Number(totalText),
        version: 1,
        commercial: {
          labourAmountMinor: Number(labourText),
          travelAmountMinor: Number(travelText),
          taxAmountMinor: Number(taxText),
        },
        grantId: input.grantId,
        secret: input.secret,
      }),
    } as Response;
  };
  pageWindow.fetch = fetchMock;
  globalThis.window = pageWindow as unknown as Window & typeof globalThis;
  globalThis.document = documentNode as unknown as Document;
  globalThis.fetch = fetchMock;
  markReactActEnvironment();
  const container = documentNode.createElement("div");
  documentNode.body.appendChild(container);
  const { createRoot } = await import("react-dom/client");
  const { CustomerQuotationDecision } = await import("./customer-quotation-decision");
  const root = createRoot(container as unknown as Element);
  try {
    await act(async () => {
      root.render(createElement(CustomerQuotationDecision, { grantId: input.grantId }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    const text = container.textContent;
    assert.equal(text.includes(input.message), true);
    assert.equal(text.includes("Approve"), false);
    assert.equal(text.includes("Decline"), false);
    assert.equal(text.includes("Confirm approval"), false);
    assert.equal(text.includes("Confirm decline"), false);
    for (const marker of input.markers) {
      assert.equal(text.includes(marker), false);
    }
    assert.equal(text.includes("ZAR"), false);
    assert.equal(text.includes(input.grantId), false);
    assert.equal(text.includes(input.secret), false);
    if (!input.retry) {
      assert.deepEqual(buttonText(container), []);
      assert.equal(text.includes("Check this link again"), false);
      assert.deepEqual(calls.map((call) => call.action), ["review"]);
    } else {
      assert.deepEqual(buttonText(container), ["Check this link again"]);
      const retry = findButton(container, "Check this link again");
      assert.ok(retry);
      await act(async () => {
        retry.dispatch("click");
      });
      await act(async () => {
        await Promise.resolve();
      });
      const afterRetry = container.textContent;
      assert.equal(afterRetry.includes(input.message), true);
      assert.equal(afterRetry.includes("Approve"), false);
      assert.equal(afterRetry.includes("Decline"), false);
      assert.equal(afterRetry.includes(input.secret), false);
      for (const marker of input.markers) {
        assert.equal(afterRetry.includes(marker), false);
      }
      assert.deepEqual(calls.map((call) => ({ url: call.url, action: call.action })), [
        { url: "/api/quotation-decision", action: "review" },
        { url: "/api/quotation-decision", action: "review" },
      ]);
    }
    assert.equal(calls.some((call) => call.action === "submit"), false);
    assert.equal(calls.every((call) => call.carriesSecret), true);
    assert.equal(calls.every((call) => call.url === "/api/quotation-decision"), true);
  } finally {
    await act(async () => {
      root.unmount();
    });
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
  }
}

const READY_COMMERCIAL = {
  labourQuantityMilli: 1500,
  labourUnit: "hour",
  labourRateMinor: 40000,
  labourAmountMinor: 60000,
  travelKilometresMilli: 25000,
  distanceBasis: "one_way" as const,
  travelRateMinor: 800,
  travelAmountMinor: 20000,
  taxableAmountMinor: 80000,
  taxTreatment: "not_registered" as const,
  taxAmountMinor: 0,
  taxRateNumerator: null,
  taxRateDenominator: null,
};
const READY_TOTAL_MINOR = 80000;

function displayedQuantity(milli: number) {
  return (milli / 1000).toLocaleString("en-ZA", { maximumFractionDigits: 3 });
}

function readyReview(description: string, customerName: string, siteName: string) {
  return {
    state: "ready" as const,
    version: 1,
    description,
    currency: "ZAR" as const,
    totalMinor: READY_TOTAL_MINOR,
    customerName,
    siteName,
    issuedAt: "2026-10-24T12:00:00.000Z",
    expiresAt: "2026-10-31T12:00:00.000Z",
    commercial: READY_COMMERCIAL,
    lines: [],
    offerTotalMinor: 80000,
  };
}

function assertReadySnapshot(text: string, description: string, customerName: string, siteName: string) {
  const labour = formatQuotationMoney("ZAR", READY_COMMERCIAL.labourAmountMinor);
  const labourRate = formatQuotationMoney("ZAR", READY_COMMERCIAL.labourRateMinor);
  const travel = formatQuotationMoney("ZAR", READY_COMMERCIAL.travelAmountMinor);
  const travelRate = formatQuotationMoney("ZAR", READY_COMMERCIAL.travelRateMinor);
  const subtotal = formatQuotationMoney("ZAR", READY_COMMERCIAL.taxableAmountMinor);
  const tax = formatQuotationMoney("ZAR", READY_COMMERCIAL.taxAmountMinor);
  const total = formatQuotationMoney("ZAR", READY_TOTAL_MINOR);
  assert.equal(labour.length > 0 && total.length > 0, true);
  assert.equal(text.includes(`${customerName} · ${siteName}`), true);
  assert.equal(text.includes("Quotation version 1"), true);
  assert.equal(text.includes("Awaiting your decision"), true);
  assert.equal(text.includes(description), true);
  assert.equal(text.includes(`Labour${displayedQuantity(READY_COMMERCIAL.labourQuantityMilli)} ${READY_COMMERCIAL.labourUnit} at ${labourRate} = ${labour}`), true);
  assert.equal(text.includes(`Travel${displayedQuantity(READY_COMMERCIAL.travelKilometresMilli)} km (one-way) at ${travelRate} = ${travel}`), true);
  assert.equal(text.includes(`Subtotal${subtotal}`), true);
  assert.equal(text.includes(`Tax${tax}. Not registered. Tax on this issued quotation is zero.`), true);
  assert.equal(text.includes(total), true);
  assert.equal(text.includes("ZAR"), true);
}

const TERMINAL_MESSAGES = [
  "This decision link is not valid.",
  "This decision link has expired.",
  "This decision link has been revoked.",
  "This quotation changed after the link was sent. Ask the office for a new link.",
  "was already approved",
  "was already declined",
  "is approved.",
  "is declined.",
  "The connection failed before the result could be confirmed.",
  "Too many attempts. Wait and open the link again.",
];

type DecisionCall = { url: string; action: string; decision: string; carriesSecret: boolean };

async function openDecisionPage(
  grantId: string,
  secret: string,
  respond: (body: { action?: string; decision?: string }) => Record<string, unknown>,
) {
  const documentNode = new MiniDocument();
  const location = {
    pathname: `/quotation-decision/${grantId}`,
    search: "",
    hash: `#${encodeURIComponent(secret)}`,
    protocol: "http:",
    href: "http://localhost/quotation-decision",
  };
  const pageWindow = {
    document: documentNode,
    location,
    history: {
      replaceState(_state: null, _title: string, url: string) {
        location.hash = "";
        location.pathname = url;
        location.search = "";
      },
    },
    navigator: { userAgent: "node" },
    HTMLIFrameElement: class HTMLIFrameElement {},
    top: null as object | null,
    self: null as object | null,
    addEventListener() {},
    removeEventListener() {},
    fetch: null as typeof fetch | null,
  };
  pageWindow.top = pageWindow;
  pageWindow.self = pageWindow;
  documentNode.defaultView = pageWindow;
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  const calls: DecisionCall[] = [];
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string; decision?: string; secret?: string };
    calls.push({
      url,
      action: body.action ?? "",
      decision: body.decision ?? "",
      carriesSecret: body.secret === secret,
    });
    return { ok: true, json: async () => respond(body) } as Response;
  };
  pageWindow.fetch = fetchMock;
  globalThis.window = pageWindow as unknown as Window & typeof globalThis;
  globalThis.document = documentNode as unknown as Document;
  globalThis.fetch = fetchMock;
  markReactActEnvironment();
  const container = documentNode.createElement("div");
  documentNode.body.appendChild(container);
  const { createRoot } = await import("react-dom/client");
  const { CustomerQuotationDecision } = await import("./customer-quotation-decision");
  const root = createRoot(container as unknown as Element);
  await act(async () => {
    root.render(createElement(CustomerQuotationDecision, { grantId }));
  });
  await act(async () => {
    await Promise.resolve();
  });
  return {
    container,
    calls,
    secret,
    async restore() {
      await act(async () => {
        root.unmount();
      });
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
      globalThis.fetch = previousFetch;
    },
  };
}

async function clickButton(container: MiniElement, label: string) {
  const button = findButton(container, label);
  assert.ok(button);
  await act(async () => {
    button.dispatch("click");
    await Promise.resolve();
  });
}

describe("expired customer decision presentation", () => {
  it("renders the expired explanation without quotation details or a decision submission", async () => {
    const documentNode = new MiniDocument();
    const location = {
      pathname: `/quotation-decision/${GRANT_ID}`,
      search: "",
      hash: `#${encodeURIComponent(SECRET)}`,
      protocol: "http:",
      href: "http://localhost/quotation-decision",
    };
    const pageWindow = {
      document: documentNode,
      location,
      history: {
        replaceState(_state: null, _title: string, url: string) {
          location.hash = "";
          location.pathname = url;
          location.search = "";
        },
      },
      navigator: { userAgent: "node" },
      HTMLIFrameElement: class HTMLIFrameElement {},
      top: null as object | null,
      self: null as object | null,
      addEventListener() {},
      removeEventListener() {},
      fetch: null as typeof fetch | null,
    };
    pageWindow.top = pageWindow;
    pageWindow.self = pageWindow;
    documentNode.defaultView = pageWindow;
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousFetch = globalThis.fetch;
    const calls: { url: string; action: string }[] = [];
    const fetchMock: typeof fetch = async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string };
      calls.push({ url, action: body.action ?? "" });
      return {
        ok: true,
        json: async () => ({
          state: "expired",
          description: "EXPIRED-DESCRIPTION-MARKER",
          customerName: "EXPIRED-CUSTOMER-MARKER",
          siteName: "EXPIRED-SITE-MARKER",
          currency: "ZAR",
          totalMinor: 424242,
          commercial: {
            labourAmountMinor: 111111,
            travelAmountMinor: 222222,
            taxAmountMinor: 333333,
          },
          grantId: GRANT_ID,
          secret: SECRET,
        }),
      } as Response;
    };
    pageWindow.fetch = fetchMock;
    globalThis.window = pageWindow as unknown as Window & typeof globalThis;
    globalThis.document = documentNode as unknown as Document;
    globalThis.fetch = fetchMock;
    markReactActEnvironment();
    const container = documentNode.createElement("div");
    documentNode.body.appendChild(container);
    const { createRoot } = await import("react-dom/client");
    const { CustomerQuotationDecision } = await import("./customer-quotation-decision");
    const root = createRoot(container as unknown as Element);
    try {
      await act(async () => {
        root.render(createElement(CustomerQuotationDecision, { grantId: GRANT_ID }));
      });
      await act(async () => {
        await Promise.resolve();
      });
      const text = container.textContent;
      assert.match(text, /This decision link has expired\./);
      const controls = buttonText(container);
      assert.deepEqual(controls, []);
      assert.equal(text.includes("Approve"), false);
      assert.equal(text.includes("Decline"), false);
      assert.equal(text.includes("Confirm approval"), false);
      assert.equal(text.includes("Confirm decline"), false);
      for (const marker of MARKERS) {
        assert.equal(text.includes(marker), false);
      }
      assert.equal(text.includes(GRANT_ID), false);
      assert.equal(text.includes(SECRET), false);
      assert.deepEqual(calls, [{ url: "/api/quotation-decision", action: "review" }]);
    } finally {
      await act(async () => {
        root.unmount();
      });
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
      globalThis.fetch = previousFetch;
    }
  });

  it("renders the revoked explanation without quotation details or a decision submission", async () => {
    const grantId = "grant-revoked-marker-92";
    const secret = "bearer-revoked-marker-92";
    const markers = [
      "REVOKED-DESCRIPTION-MARKER",
      "REVOKED-CUSTOMER-MARKER",
      "REVOKED-SITE-MARKER",
      "525252",
      "444444",
      "555555",
      "666666",
    ];
    const documentNode = new MiniDocument();
    const location = {
      pathname: `/quotation-decision/${grantId}`,
      search: "",
      hash: `#${encodeURIComponent(secret)}`,
      protocol: "http:",
      href: "http://localhost/quotation-decision",
    };
    const pageWindow = {
      document: documentNode,
      location,
      history: {
        replaceState(_state: null, _title: string, url: string) {
          location.hash = "";
          location.pathname = url;
          location.search = "";
        },
      },
      navigator: { userAgent: "node" },
      HTMLIFrameElement: class HTMLIFrameElement {},
      top: null as object | null,
      self: null as object | null,
      addEventListener() {},
      removeEventListener() {},
      fetch: null as typeof fetch | null,
    };
    pageWindow.top = pageWindow;
    pageWindow.self = pageWindow;
    documentNode.defaultView = pageWindow;
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousFetch = globalThis.fetch;
    const calls: { url: string; action: string }[] = [];
    const fetchMock: typeof fetch = async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string };
      calls.push({ url, action: body.action ?? "" });
      return {
        ok: true,
        json: async () => ({
          state: "revoked",
          description: "REVOKED-DESCRIPTION-MARKER",
          customerName: "REVOKED-CUSTOMER-MARKER",
          siteName: "REVOKED-SITE-MARKER",
          currency: "ZAR",
          totalMinor: 525252,
          commercial: {
            labourAmountMinor: 444444,
            travelAmountMinor: 555555,
            taxAmountMinor: 666666,
          },
          grantId,
          secret,
        }),
      } as Response;
    };
    pageWindow.fetch = fetchMock;
    globalThis.window = pageWindow as unknown as Window & typeof globalThis;
    globalThis.document = documentNode as unknown as Document;
    globalThis.fetch = fetchMock;
    markReactActEnvironment();
    const container = documentNode.createElement("div");
    documentNode.body.appendChild(container);
    const { createRoot } = await import("react-dom/client");
    const { CustomerQuotationDecision } = await import("./customer-quotation-decision");
    const root = createRoot(container as unknown as Element);
    try {
      await act(async () => {
        root.render(createElement(CustomerQuotationDecision, { grantId }));
      });
      await act(async () => {
        await Promise.resolve();
      });
      const text = container.textContent;
      assert.match(text, /This decision link has been revoked\./);
      assert.deepEqual(buttonText(container), []);
      assert.equal(text.includes("Approve"), false);
      assert.equal(text.includes("Decline"), false);
      assert.equal(text.includes("Confirm approval"), false);
      assert.equal(text.includes("Confirm decline"), false);
      for (const marker of markers) {
        assert.equal(text.includes(marker), false);
      }
      assert.equal(text.includes(grantId), false);
      assert.equal(text.includes(secret), false);
      assert.deepEqual(calls, [{ url: "/api/quotation-decision", action: "review" }]);
    } finally {
      await act(async () => {
        root.unmount();
      });
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
      globalThis.fetch = previousFetch;
    }
  });

  it("renders the stale explanation without quotation details or a decision submission", async () => {
    const grantId = "grant-stale-marker-93";
    const secret = "bearer-stale-marker-93";
    const markers = [
      "STALE-DESCRIPTION-MARKER",
      "STALE-CUSTOMER-MARKER",
      "STALE-SITE-MARKER",
      "636363",
      "777777",
      "888888",
      "999999",
    ];
    const documentNode = new MiniDocument();
    const location = {
      pathname: `/quotation-decision/${grantId}`,
      search: "",
      hash: `#${encodeURIComponent(secret)}`,
      protocol: "http:",
      href: "http://localhost/quotation-decision",
    };
    const pageWindow = {
      document: documentNode,
      location,
      history: {
        replaceState(_state: null, _title: string, url: string) {
          location.hash = "";
          location.pathname = url;
          location.search = "";
        },
      },
      navigator: { userAgent: "node" },
      HTMLIFrameElement: class HTMLIFrameElement {},
      top: null as object | null,
      self: null as object | null,
      addEventListener() {},
      removeEventListener() {},
      fetch: null as typeof fetch | null,
    };
    pageWindow.top = pageWindow;
    pageWindow.self = pageWindow;
    documentNode.defaultView = pageWindow;
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousFetch = globalThis.fetch;
    const calls: { url: string; action: string }[] = [];
    const fetchMock: typeof fetch = async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string };
      calls.push({ url, action: body.action ?? "" });
      return {
        ok: true,
        json: async () => ({
          state: "stale",
          description: "STALE-DESCRIPTION-MARKER",
          customerName: "STALE-CUSTOMER-MARKER",
          siteName: "STALE-SITE-MARKER",
          currency: "ZAR",
          totalMinor: 636363,
          commercial: {
            labourAmountMinor: 777777,
            travelAmountMinor: 888888,
            taxAmountMinor: 999999,
          },
          grantId,
          secret,
        }),
      } as Response;
    };
    pageWindow.fetch = fetchMock;
    globalThis.window = pageWindow as unknown as Window & typeof globalThis;
    globalThis.document = documentNode as unknown as Document;
    globalThis.fetch = fetchMock;
    markReactActEnvironment();
    const container = documentNode.createElement("div");
    documentNode.body.appendChild(container);
    const { createRoot } = await import("react-dom/client");
    const { CustomerQuotationDecision } = await import("./customer-quotation-decision");
    const root = createRoot(container as unknown as Element);
    try {
      await act(async () => {
        root.render(createElement(CustomerQuotationDecision, { grantId }));
      });
      await act(async () => {
        await Promise.resolve();
      });
      const text = container.textContent;
      assert.match(text, /This quotation changed after the link was sent\. Ask the office for a new link\./);
      assert.deepEqual(buttonText(container), []);
      assert.equal(text.includes("Approve"), false);
      assert.equal(text.includes("Decline"), false);
      assert.equal(text.includes("Confirm approval"), false);
      assert.equal(text.includes("Confirm decline"), false);
      for (const marker of markers) {
        assert.equal(text.includes(marker), false);
      }
      assert.equal(text.includes(grantId), false);
      assert.equal(text.includes(secret), false);
      assert.deepEqual(calls, [{ url: "/api/quotation-decision", action: "review" }]);
    } finally {
      await act(async () => {
        root.unmount();
      });
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
      globalThis.fetch = previousFetch;
    }
  });

  it("renders the used approved explanation without quotation details or a decision submission", async () => {
    await renderConsumedDecision("approved");
  });

  it("renders the used declined explanation without quotation details or a decision submission", async () => {
    await renderConsumedDecision("declined");
  });

  it("renders the invalid explanation without quotation details, a retry, or a decision submission", async () => {
    await renderUnverifiedDecision({
      grantId: "grant-invalid-marker-96",
      secret: "bearer-invalid-marker-96",
      markers: [
        "INVALID-DESCRIPTION-MARKER",
        "INVALID-CUSTOMER-MARKER",
        "INVALID-SITE-MARKER",
        "969696",
        "161616",
        "171717",
        "181818",
      ],
      state: "invalid",
      message: "This decision link is not valid.",
      retry: false,
    });
  });

  it("renders the unavailable explanation and retries the review without submitting", async () => {
    await renderUnverifiedDecision({
      grantId: "grant-unavailable-marker-97",
      secret: "bearer-unavailable-marker-97",
      markers: [
        "UNAVAILABLE-DESCRIPTION-MARKER",
        "UNAVAILABLE-CUSTOMER-MARKER",
        "UNAVAILABLE-SITE-MARKER",
        "979797",
        "191919",
        "212121",
        "232323",
      ],
      state: "unavailable",
      message: "The connection failed before the result could be confirmed. Check the link again before trying a second time. A saved decision will not be recorded twice.",
      retry: true,
    });
  });

  it("renders the ready quotation snapshot with decision controls and no terminal message", async () => {
    const grantId = "grant-ready-marker-98";
    const secret = "bearer-ready-marker-98";
    const description = "READY-DESCRIPTION-MARKER";
    const customerName = "READY-CUSTOMER-MARKER";
    const siteName = "READY-SITE-MARKER";
    const page = await openDecisionPage(grantId, secret, () => readyReview(description, customerName, siteName));
    try {
      const text = page.container.textContent;
      assertReadySnapshot(text, description, customerName, siteName);
      assert.deepEqual(buttonText(page.container), ["Approve", "Decline"]);
      for (const message of TERMINAL_MESSAGES) {
        assert.equal(text.includes(message), false);
      }
      assert.equal(text.includes(secret), false);
      assert.equal(text.includes(grantId), false);
      assert.deepEqual(page.calls.map((call) => ({ url: call.url, action: call.action, decision: call.decision })), [
        { url: "/api/quotation-decision", action: "review", decision: "" },
      ]);
      assert.equal(page.calls.every((call) => call.carriesSecret), true);
    } finally {
      await page.restore();
    }
  });

  it("confirms the first approval without sending another submission", async () => {
    await confirmFirstDecision("approved");
  });

  it("confirms the first decline without sending another submission", async () => {
    await confirmFirstDecision("declined");
  });

  it("renders the limited explanation without quotation details, a retry, or a decision submission", async () => {
    await renderUnverifiedDecision({
      grantId: "grant-limited-marker-101",
      secret: "bearer-limited-marker-101",
      markers: [
        "LIMITED-DESCRIPTION-MARKER",
        "LIMITED-CUSTOMER-MARKER",
        "LIMITED-SITE-MARKER",
        "989898",
        "242424",
        "252525",
        "262626",
      ],
      state: "limited",
      message: "Too many attempts. Wait and open the link again.",
      retry: false,
    });
  });
});

async function confirmFirstDecision(decision: "approved" | "declined") {
  const grantId = decision === "approved" ? "grant-approve-confirm-99" : "grant-decline-confirm-100";
  const secret = decision === "approved" ? "bearer-approve-confirm-99" : "bearer-decline-confirm-100";
  const description = decision === "approved" ? "APPROVE-DESCRIPTION-MARKER" : "DECLINE-DESCRIPTION-MARKER";
  const customerName = decision === "approved" ? "APPROVE-CUSTOMER-MARKER" : "DECLINE-CUSTOMER-MARKER";
  const siteName = decision === "approved" ? "APPROVE-SITE-MARKER" : "DECLINE-SITE-MARKER";
  const page = await openDecisionPage(grantId, secret, (body) => {
    if (body.action === "submit") return { state: decision, version: 1 };
    return readyReview(description, customerName, siteName);
  });
  try {
    const readyText = page.container.textContent;
    assertReadySnapshot(readyText, description, customerName, siteName);
    assert.deepEqual(buttonText(page.container), ["Approve", "Decline"]);
    await clickButton(page.container, decision === "approved" ? "Approve" : "Decline");
    const confirmLabel = decision === "approved" ? "Confirm approval" : "Confirm decline";
    assert.equal(page.container.textContent.includes(`Confirm that you want to ${decision === "approved" ? "approve" : "decline"} version 1.`), true);
    assert.deepEqual(buttonText(page.container), [confirmLabel, "Back"]);
    assert.deepEqual(page.calls.map((call) => call.action), ["review"]);
    await clickButton(page.container, confirmLabel);
    await act(async () => {
      await Promise.resolve();
    });
    const confirmed = page.container.textContent;
    assert.equal(confirmed.includes(`Version 1 is ${decision}.`), true);
    assert.equal(confirmed.includes(`Version 1 is ${decision === "approved" ? "declined" : "approved"}.`), false);
    assert.equal(confirmed.includes("Awaiting your decision"), false);
    assert.equal(confirmed.includes(description), false);
    assert.equal(confirmed.includes(secret), false);
    assert.equal(confirmed.includes("Approve"), false);
    assert.equal(confirmed.includes("Decline"), false);
    assert.equal(confirmed.includes("Confirm approval"), false);
    assert.equal(confirmed.includes("Confirm decline"), false);
    assert.deepEqual(buttonText(page.container), []);
    assert.deepEqual(page.calls.map((call) => ({ url: call.url, action: call.action, decision: call.decision })), [
      { url: "/api/quotation-decision", action: "review", decision: "" },
      { url: "/api/quotation-decision", action: "submit", decision },
    ]);
    assert.equal(page.calls.every((call) => call.carriesSecret), true);
    await act(async () => {
      await Promise.resolve();
    });
    assert.equal(page.calls.length, 2);
    assert.equal(page.calls.some((call) => call.action === "submit" && call.decision !== decision), false);
  } finally {
    await page.restore();
  }
}
