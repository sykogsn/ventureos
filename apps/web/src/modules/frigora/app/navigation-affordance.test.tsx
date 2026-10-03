import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { VentureId, WorkspaceId } from "@/contracts";
import { ShellProvider } from "@/core/context/shell-context";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import {
  FrigoraAssetLink,
  FrigoraCustomerLink,
  FrigoraCustomerSiteLinks,
  FrigoraSiteAddressLink,
  FrigoraSiteLink,
  FrigoraVisitLink,
  FrigoraWorkOrderLink,
} from "@/modules/frigora/app/entity-link";
import {
  formatFrigoraSiteAddress,
  frigoraAssetHref,
  frigoraCustomerHref,
  frigoraSiteHref,
  frigoraVisitHref,
  frigoraWorkOrderHref,
} from "@/modules/frigora/app/entity-routes";
import { CustomersScreen } from "@/modules/frigora/app/screens/customers-screen";
import { MyWorkScreen } from "@/modules/frigora/app/screens/my-work-screen";
import { OperationsScreen } from "@/modules/frigora/app/screens/operations-screen";
import { AssetDetailScreen, SiteDetailScreen } from "@/modules/frigora/app/screens/site-asset-screens";
import { WorkDetailScreen, WorkListScreen } from "@/modules/frigora/app/screens/work-screens";
import type {
  DispatchBoardItem,
  OperationsOverviewView,
  WorkOrderDetailView,
  WorkOrderListRow,
} from "@/modules/frigora/app/views";
import type {
  FrigoraAsset,
  FrigoraCustomer,
  FrigoraSite,
  FrigoraVisit,
  FrigoraWorkOrder,
} from "@/modules/frigora/types";

const NOW = "2026-10-03T08:00:00.000Z";
const VENTURE = "ven-1";
const WEB_ROOT = join(process.cwd(), "src");

const ctx: FrigoraOpsContext = {
  sessionUserId: "user-1",
  workspaceId: "ws-1" as WorkspaceId,
  ventureId: VENTURE as VentureId,
  venture: {
    id: VENTURE as VentureId,
    workspaceId: "ws-1" as WorkspaceId,
    name: "Frigora Cold",
    slug: "frigora-cold",
    definitionId: "frigora",
  },
  canWrite: false,
};

function customer(): FrigoraCustomer {
  return {
    id: "cus-1" as FrigoraCustomer["id"],
    workspaceId: "ws-1" as WorkspaceId,
    ventureId: VENTURE as VentureId,
    code: "FUEL",
    displayName: "FuelCo",
    legalName: "FuelCo Ltd",
    status: "active",
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function site(): FrigoraSite {
  return {
    id: "site-1" as FrigoraSite["id"],
    workspaceId: "ws-1" as WorkspaceId,
    ventureId: VENTURE as VentureId,
    customerId: "cus-1" as FrigoraCustomer["id"],
    code: "LEEDS",
    name: "Leeds Cold Store",
    addressLine1: "1 High Street",
    addressLine2: null,
    city: "Leeds",
    region: null,
    postalCode: "LS1 1AA",
    country: "GB",
    status: "active",
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function asset(): FrigoraAsset {
  return {
    id: "asset-1" as FrigoraAsset["id"],
    workspaceId: "ws-1" as WorkspaceId,
    ventureId: VENTURE as VentureId,
    siteId: "site-1" as FrigoraSite["id"],
    tag: "A-1",
    name: "Evaporator",
    assetKind: null,
    manufacturer: null,
    model: null,
    serialNumber: null,
    status: "active",
    designTargetCelsius: null,
    refrigerantType: null,
    locationOnSite: null,
    installedOn: null,
    commissionedOn: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function workOrder(): FrigoraWorkOrder {
  return {
    id: "wo-1" as FrigoraWorkOrder["id"],
    workspaceId: "ws-1" as WorkspaceId,
    ventureId: VENTURE as VentureId,
    customerId: "cus-1" as FrigoraCustomer["id"],
    siteId: "site-1" as FrigoraSite["id"],
    primaryAssetId: "asset-1" as FrigoraAsset["id"],
    workReference: "WO-1864",
    workKind: "reactive",
    priority: "normal",
    reportedCondition: "Cabinet warm",
    status: "open",
    assignedUserId: "user-eng" as FrigoraWorkOrder["assignedUserId"],
    scheduledStartAt: null,
    scheduledEndAt: null,
    assignmentAcceptedAt: null,
    assignmentDeclinedAt: null,
    assignmentDeclineReason: null,
    cancellationReason: null,
    sourceRecommendedActionId: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function visit(): FrigoraVisit {
  return {
    id: "visit-1" as FrigoraVisit["id"],
    workspaceId: "ws-1" as WorkspaceId,
    ventureId: VENTURE as VentureId,
    workOrderId: "wo-1" as FrigoraWorkOrder["id"],
    attendingUserId: "user-eng" as FrigoraVisit["attendingUserId"],
    arrivedAt: NOW,
    departedAt: null,
    labourHourlyChargeCents: null,
    status: "open",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function shell(children: ReactNode) {
  return (
    <ShellProvider
      user={{ name: "Sonny", email: "sonny@example.com" }}
      workspaces={[{ id: "ws-1" as WorkspaceId, name: "Workspace", slug: "workspace" }]}
      ventures={[ctx.venture]}
      initialWorkspaceId={"ws-1" as WorkspaceId}
    >
      {children}
    </ShellProvider>
  );
}

function markup(node: ReactNode): string {
  return renderToStaticMarkup(shell(node));
}

type Anchor = { href: string; text: string; label: string | null; attrs: string };

function anchors(html: string): Anchor[] {
  const found: Anchor[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const attrs = match[1] ?? "";
    found.push({
      href: /href="([^"]*)"/.exec(attrs)?.[1] ?? "",
      text: (match[2] ?? "").replace(/<[^>]+>/g, ""),
      label: /aria-label="([^"]*)"/.exec(attrs)?.[1] ?? null,
      attrs,
    });
  }
  return found;
}

function anchorByText(html: string, text: string): Anchor {
  const match = anchors(html).find((item) => item.text.includes(text));
  assert.ok(match, `expected an anchor containing ${text}`);
  return match;
}

describe("Frigora entity routes", () => {
  it("builds deterministic hrefs inside the current venture", () => {
    const customerHref = frigoraCustomerHref(VENTURE, "cus-1");
    const siteHref = frigoraSiteHref(VENTURE, "cus-1", "site-1");
    const assetHref = frigoraAssetHref(VENTURE, "cus-1", "site-1", "asset-1");
    const workHref = frigoraWorkOrderHref(VENTURE, "wo-1");
    const visitHref = frigoraVisitHref(VENTURE, "wo-1", "visit-1");

    assert.equal(customerHref, "/ventures/ven-1/customers/cus-1");
    assert.equal(siteHref, "/ventures/ven-1/customers/cus-1/sites/site-1");
    assert.equal(assetHref, "/ventures/ven-1/customers/cus-1/sites/site-1/assets/asset-1");
    assert.equal(workHref, "/ventures/ven-1/work/wo-1");
    assert.equal(visitHref, "/ventures/ven-1/work/wo-1/visit/visit-1");
    assert.equal(frigoraCustomerHref(VENTURE, "cus-1"), customerHref);
    for (const href of [customerHref, siteHref, assetHref, workHref, visitHref]) {
      assert.match(href, /^\/ventures\/ven-1\//);
      assert.equal(href.includes("ven-2"), false);
      assert.equal(href.includes("?"), false);
    }
  });

  it("encodes path segments so a venture id cannot be split", () => {
    assert.equal(
      frigoraWorkOrderHref("ven/other", "wo 1"),
      "/ventures/ven%2Fother/work/wo%201",
    );
  });

  it("does not invent an access or mutation channel", () => {
    const source = readFileSync(join(WEB_ROOT, "modules/frigora/app/entity-routes.ts"), "utf8");
    const link = readFileSync(join(WEB_ROOT, "modules/frigora/app/entity-link.tsx"), "utf8");
    assert.equal(source.includes("permissions"), false);
    assert.equal(source.includes("mutation-actions"), false);
    assert.equal(link.includes("router.push"), false);
    assert.equal(link.includes("onClick"), false);
    const customerPage = readFileSync(
      join(WEB_ROOT, "app/(app)/ventures/[ventureId]/customers/[customerId]/page.tsx"),
      "utf8",
    );
    const workPage = readFileSync(
      join(WEB_ROOT, "app/(app)/ventures/[ventureId]/work/[workOrderId]/page.tsx"),
      "utf8",
    );
    assert.match(customerPage, /requireFrigoraOpsContext/);
    assert.match(workPage, /requireFrigoraOpsContext/);
  });
});

describe("Frigora entity links", () => {
  it("navigates a displayed customer, site, asset, work order, and visit", () => {
    const html = renderToStaticMarkup(
      <>
        <FrigoraCustomerLink ventureId={VENTURE} customer={customer()} />
        <FrigoraSiteLink ventureId={VENTURE} site={site()} />
        <FrigoraSiteAddressLink ventureId={VENTURE} site={site()} />
        <FrigoraAssetLink
          ventureId={VENTURE}
          customerId={customer().id}
          siteId={site().id}
          asset={asset()}
        />
        <FrigoraWorkOrderLink
          ventureId={VENTURE}
          workOrderId={workOrder().id}
          workReference={workOrder().workReference}
        />
        <FrigoraVisitLink ventureId={VENTURE} workOrderId={workOrder().id} visitId={visit().id}>
          Open visit
        </FrigoraVisitLink>
      </>,
    );
    const found = anchors(html);
    assert.equal(found.length, 6);
    assert.equal(anchorByText(html, "FuelCo").href, frigoraCustomerHref(VENTURE, "cus-1"));
    assert.equal(anchorByText(html, "Leeds Cold Store").href, frigoraSiteHref(VENTURE, "cus-1", "site-1"));
    const address = anchorByText(html, "1 High Street");
    assert.equal(address.href, frigoraSiteHref(VENTURE, "cus-1", "site-1"));
    assert.equal(address.label, "Leeds Cold Store, 1 High Street, Leeds, LS1 1AA, GB");
    assert.equal(anchorByText(html, "A-1").href, frigoraAssetHref(VENTURE, "cus-1", "site-1", "asset-1"));
    assert.equal(anchorByText(html, "WO-1864").href, frigoraWorkOrderHref(VENTURE, "wo-1"));
    assert.equal(anchorByText(html, "Open visit").href, frigoraVisitHref(VENTURE, "wo-1", "visit-1"));
    for (const item of found) {
      assert.match(item.attrs, /vos-entity-link/);
      assert.equal(item.attrs.includes("onclick"), false);
      assert.equal(item.attrs.includes('tabindex="-1"'), false);
      assert.equal(item.href.startsWith(`/ventures/${VENTURE}/`), true);
    }
  });

  it("keeps missing destinations as text", () => {
    const html = renderToStaticMarkup(
      <>
        <FrigoraCustomerLink ventureId={VENTURE} customer={null} />
        <FrigoraCustomerSiteLinks ventureId={VENTURE} customer={null} site={null} />
        <FrigoraSiteAddressLink ventureId={VENTURE} site={{ ...site(), addressLine1: null, addressLine2: null, city: null, region: null, postalCode: null, country: null }} />
        <FrigoraAssetLink ventureId={VENTURE} customerId={null} siteId={null} asset={asset()} />
        <FrigoraWorkOrderLink ventureId={VENTURE} workOrderId="" workReference="WO-1864" />
        <span>Pat Engineer</span>
      </>,
    );
    assert.equal(anchors(html).length, 0);
    assert.match(html, /A-1 — Evaporator/);
    assert.match(html, /Pat Engineer/);
    assert.equal(html.includes("href="), false);
  });

  it("formats a site address without turning an empty address into a link target", () => {
    assert.equal(formatFrigoraSiteAddress(site()), "1 High Street, Leeds, LS1 1AA, GB");
    assert.equal(formatFrigoraSiteAddress(null), "");
  });
});

describe("Frigora operational surfaces", () => {
  it("links the customer list name and preserves the venture", () => {
    const html = markup(<CustomersScreen ctx={ctx} customers={[customer()]} />);
    assert.equal(anchorByText(html, "FuelCo").href, frigoraCustomerHref(VENTURE, "cus-1"));
    assert.equal(anchorByText(html, "FUEL").href, frigoraCustomerHref(VENTURE, "cus-1"));
  });

  it("links the work list and work detail identities without linking the engineer", () => {
    const row: WorkOrderListRow = {
      workOrder: workOrder(),
      customer: customer(),
      site: site(),
      asset: asset(),
      assignee: { id: "user-eng", name: "Pat Engineer", email: "pat@example.com" },
      visitCount: 1,
      hasActiveVisit: true,
      latestVisit: visit(),
    };
    const list = markup(
      <WorkListScreen ctx={ctx} rows={[row]} filters={{ status: "all", assignment: "all" }} />,
    );
    assert.equal(anchorByText(list, "WO-1864").href, frigoraWorkOrderHref(VENTURE, "wo-1"));
    assert.equal(anchorByText(list, "FuelCo").href, frigoraCustomerHref(VENTURE, "cus-1"));
    assert.equal(anchorByText(list, "Leeds Cold Store").href, frigoraSiteHref(VENTURE, "cus-1", "site-1"));
    assert.equal(
      anchorByText(list, NOW).href,
      frigoraVisitHref(VENTURE, "wo-1", "visit-1"),
    );
    assert.equal(anchors(list).some((item) => item.text.includes("Pat Engineer")), false);
    assert.match(list, /Pat Engineer/);

    const detailView: WorkOrderDetailView = {
      workOrder: workOrder(),
      customer: customer(),
      site: site(),
      asset: asset(),
      assignee: { id: "user-eng", name: "Pat Engineer", email: "pat@example.com" },
      visits: [],
      visitAttendees: {},
      visitFacts: [],
      workOrderRecommendations: [],
      followUpByRecommendedActionId: {},
      workOrderEvidence: [],
      currentOperationalCondition: null,
      attentionSignals: [],
      latestVisitId: null,
      members: [],
      timeMaterials: null,
    };
    const detail = markup(<WorkDetailScreen ctx={ctx} view={detailView} />);
    assert.equal(anchorByText(detail, "FuelCo").href, frigoraCustomerHref(VENTURE, "cus-1"));
    assert.equal(
      anchorByText(detail, "1 High Street").href,
      frigoraSiteHref(VENTURE, "cus-1", "site-1"),
    );
    assert.equal(
      anchorByText(detail, "A-1").href,
      frigoraAssetHref(VENTURE, "cus-1", "site-1", "asset-1"),
    );
    assert.equal(anchors(detail).some((item) => item.text.includes("Pat Engineer")), false);
    assert.equal(detail.includes("<form"), false);
  });

  it("links my work, site, and asset surfaces", () => {
    const mine = markup(
      <MyWorkScreen
        ctx={ctx}
        rows={[
          {
            workOrder: workOrder(),
            customer: customer(),
            site: site(),
            asset: asset(),
            activeVisit: null,
            latestVisit: null,
            responseState: "accepted",
          },
        ]}
      />,
    );
    assert.equal(anchorByText(mine, "WO-1864").href, frigoraWorkOrderHref(VENTURE, "wo-1"));
    assert.equal(anchorByText(mine, "FuelCo").href, frigoraCustomerHref(VENTURE, "cus-1"));
    assert.equal(anchorByText(mine, "1 High Street").href, frigoraSiteHref(VENTURE, "cus-1", "site-1"));
    assert.equal(anchorByText(mine, "A-1").href, frigoraAssetHref(VENTURE, "cus-1", "site-1", "asset-1"));

    const siteHtml = markup(
      <SiteDetailScreen ctx={ctx} customer={customer()} site={site()} assets={[asset()]} />,
    );
    assert.equal(anchorByText(siteHtml, "FuelCo").href, frigoraCustomerHref(VENTURE, "cus-1"));
    assert.equal(
      anchorByText(siteHtml, "A-1").href,
      frigoraAssetHref(VENTURE, "cus-1", "site-1", "asset-1"),
    );

    const assetHtml = markup(
      <AssetDetailScreen ctx={ctx} customer={customer()} site={site()} asset={asset()} />,
    );
    assert.equal(anchorByText(assetHtml, "FuelCo").href, frigoraCustomerHref(VENTURE, "cus-1"));
    assert.equal(anchorByText(assetHtml, "Leeds Cold Store").href, frigoraSiteHref(VENTURE, "cus-1", "site-1"));
    assert.equal(anchors(assetHtml).some((item) => item.text === "A-1"), false);
  });

  it("links service desk customer, site, and work order references", () => {
    const item: DispatchBoardItem = {
      workOrder: workOrder(),
      customer: customer(),
      site: site(),
      assignee: { id: "user-eng", name: "Pat Engineer", email: "pat@example.com" },
      visits: [],
      responseState: "accepted",
      bucket: "accepted",
      signals: [],
    };
    const board: OperationsOverviewView["board"] = {
      unscheduled: [],
      scheduled_unassigned: [],
      awaiting_response: [],
      accepted: [item],
      declined: [],
      active: [],
      completed: [],
    };
    const view: OperationsOverviewView = {
      counts: {
        openWork: 1,
        assignedOpen: 1,
        unassignedOpen: 0,
        activeVisits: 0,
        visitedStillOpen: 0,
      },
      attention: [
        {
          workOrder: workOrder(),
          customer: customer(),
          site: site(),
          assignee: item.assignee,
          signals: ["NO_VISIT_RECORDED"],
        },
      ],
      recentActivity: [
        {
          kind: "work_order_created",
          occurredAt: NOW,
          sourceId: "src-1",
          workOrderId: workOrder().id,
          workOrderReference: workOrder().workReference,
          visitId: null,
          assetId: null,
          label: "Work order created",
          detail: null,
        },
      ],
      range: { date: "2026-10-03", start: NOW, end: NOW },
      members: item.assignee ? [item.assignee] : [],
      board,
      calendar: { engineerId: null, groups: [] },
      unassignedQueue: [],
    };
    const html = markup(<OperationsScreen ctx={ctx} view={view} />);
    const workLinks = anchors(html).filter((anchor) => anchor.text.includes("WO-1864"));
    assert.equal(workLinks.length >= 3, true);
    for (const anchor of workLinks) {
      assert.equal(anchor.href, frigoraWorkOrderHref(VENTURE, "wo-1"));
    }
    assert.equal(anchorByText(html, "FuelCo").href, frigoraCustomerHref(VENTURE, "cus-1"));
    assert.equal(anchorByText(html, "Leeds Cold Store").href, frigoraSiteHref(VENTURE, "cus-1", "site-1"));
    assert.equal(anchors(html).some((anchor) => anchor.text.includes("Pat Engineer")), false);
  });

  it("wires visit entry and the visit recorder to the same entity routes", () => {
    const entry = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/screens/visit-entry-screen.tsx"),
      "utf8",
    );
    const recorder = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/screens/visit-recorder-screen.tsx"),
      "utf8",
    );
    for (const source of [entry, recorder]) {
      assert.match(source, /FrigoraWorkOrderLink/);
      assert.match(source, /FrigoraCustomerSiteLinks/);
      assert.match(source, /FrigoraSiteAddressLink/);
      assert.match(source, /FrigoraAssetLink/);
    }
    assert.match(recorder, /FrigoraVisitLink/);
  });

  it("leaves engineers, catalogue items, and offline snapshot labels non-navigable", () => {
    const calendar = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/screens/engineer-calendar-panel.tsx"),
      "utf8",
    );
    const catalogue = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/screens/catalogue-screen.tsx"),
      "utf8",
    );
    const offline = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/offline/offline-fallback-panels.tsx"),
      "utf8",
    );
    assert.match(calendar, /group\.assignee\?\.name \?\? group\.engineerId/);
    assert.equal(calendar.includes("members/"), false);
    assert.equal(catalogue.includes("entity-link"), false);
    assert.equal(offline.includes("entity-link"), false);
    assert.equal(calendar.includes(":visited"), false);
  });

  it("keeps entity-link focus visible in the product stylesheet", () => {
    const css = readFileSync(join(WEB_ROOT, "app/globals.css"), "utf8");
    assert.match(css, /\.vos-entity-link:hover/);
    assert.match(css, /\.vos-entity-link:focus-visible/);
    assert.match(css, /a:focus-visible/);
    assert.equal(css.includes(".vos-entity-link:visited"), false);
  });
});
