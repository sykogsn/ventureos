import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import { FRIGORA_FIELD_WORKFLOW_LABEL } from "@/modules/frigora/app/field-workflow";
import { shouldBlockFrigoraFieldMutation } from "@/modules/frigora/app/pwa/connectivity";
import { frigoraWebAppManifest } from "@/modules/frigora/app/pwa/web-app-manifest";
import {
  FRIGORA_CONNECTIVITY_OFFLINE_BODY,
  FRIGORA_CONNECTIVITY_RESTORED_BODY,
  FRIGORA_DOCUMENT_TITLE_TEMPLATE,
  FRIGORA_EVIDENCE_ONLINE_NOTE,
  FRIGORA_OFFLINE_PAGE_BODY,
  FRIGORA_OFFLINE_PAGE_TITLE,
  FRIGORA_AUTH_LOADING_MESSAGE,
  FRIGORA_AUTH_SIGN_IN_TITLE,
  FRIGORA_AUTH_TRUST_NOTES,
  FRIGORA_PWA_DESCRIPTION,
  FRIGORA_PWA_NAME,
  FRIGORA_PWA_SHORT_NAME,
} from "@/modules/frigora/app/pwa/copy";
import {
  FRIGORA_PWA_ICON_PATHS,
  FRIGORA_PWA_MANIFEST_PATH,
  FRIGORA_PWA_OFFLINE_PATH,
  FRIGORA_PWA_SERVICE_WORKER_PATH,
  FRIGORA_PWA_START_PATH,
  VENTUREOS_ORIGIN_MANIFEST_PATH,
  isFrigoraAuthContinuation,
  isFrigoraPwaPublicPath,
} from "@/modules/frigora/app/pwa/paths";

const WEB_ROOT = join(process.cwd(), "src");
const WEB_APP = join(process.cwd());

function read(rel: string) {
  return readFileSync(join(WEB_ROOT, rel), "utf8");
}

function readPublic(rel: string) {
  return readFileSync(join(WEB_APP, "public", rel), "utf8");
}

const forbiddenOfflineCapability = [
  "indexedDB",
  "BackgroundSync",
  "sync-engine",
  "conflict resolution",
  "queued write",
  "offline job",
  "evidence queue",
];

describe("Frigora F3.2 online PWA boundary", () => {
  it("installs as Frigora, not a generic VentureOS product", () => {
    const manifest = frigoraWebAppManifest();
    const manifestJson = JSON.stringify(manifest);
    const identity = read("modules/frigora/app/pwa/identity.ts");
    const frigoraLayout = read("app/(app)/frigora/layout.tsx");
    const rootLayout = read("app/layout.tsx");

    assert.equal(manifest.name, FRIGORA_PWA_NAME);
    assert.equal(manifest.short_name, FRIGORA_PWA_SHORT_NAME);
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.start_url, FRIGORA_PWA_START_PATH);
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.theme_color, "#3d5248");
    assert.deepEqual(manifest.frigora_product, {
      id: platformVentureRegistry.resolve("frigora").id,
      version: platformVentureRegistry.resolve("frigora").version,
    });
    assert.equal(
      manifestJson.includes(FRIGORA_PWA_ICON_PATHS.icon192),
      true,
    );
    assert.equal(
      manifestJson.includes(FRIGORA_PWA_ICON_PATHS.icon512),
      true,
    );
    assert.equal(manifestJson.includes('"frigora_product"'), true);

    assert.equal(FRIGORA_PWA_NAME, "Frigora");
    assert.equal(FRIGORA_PWA_SHORT_NAME, "Frigora");
    assert.equal(FRIGORA_PWA_START_PATH, "/frigora");
    assert.equal(FRIGORA_PWA_DESCRIPTION.includes("VentureOS"), false);

    assert.match(identity, /applicationName: FRIGORA_PWA_NAME/);
    assert.match(identity, /appleWebApp/);
    assert.match(identity, /viewportFit: "cover"/);

    assert.match(frigoraLayout, /frigoraCustomerFacingMetadata/);
    assert.match(frigoraLayout, /frigoraCustomerFacingViewport/);

    assert.match(rootLayout, /applicationName: "VentureOS"/);
    assert.equal(rootLayout.includes("FRIGORA_PWA_NAME"), false);

    const globals = read("app/globals.css");
    assert.match(globals, /safe-area-inset-top/);
    assert.match(globals, /data-frigora-offline/);
    assert.match(
      globals,
      /form:not\(\[data-frigora-offline-capture="recordTechnicalFinding"\]\):not\(\[data-frigora-offline-capture="recordFieldCapture"\]\):not\(\[data-frigora-offline-capture="recordVisitEvidence"\]\)/,
    );
    assert.match(globals, /pointer-events:\s*none/);
    assert.equal(globals.includes('data-frigora-offline-capture="removeVisitEvidence"'), false);
  });
  it("keeps install assets public and session-gates Frigora start and field routes", () => {
    const proxy = read("proxy.ts");
    assert.match(proxy, /isFrigoraPwaPublicPath/);
    assert.match(proxy, /loginRedirect/);
    assert.match(proxy, /SESSION_COOKIE/);
    assert.match(proxy, /nextUrl\.search/);
    assert.equal(isFrigoraPwaPublicPath(FRIGORA_PWA_SERVICE_WORKER_PATH), true);
    assert.equal(isFrigoraPwaPublicPath(FRIGORA_PWA_OFFLINE_PATH), true);
    assert.equal(isFrigoraPwaPublicPath(FRIGORA_PWA_MANIFEST_PATH), true);
    assert.equal(isFrigoraPwaPublicPath(VENTUREOS_ORIGIN_MANIFEST_PATH), true);
    assert.equal(isFrigoraPwaPublicPath(FRIGORA_PWA_ICON_PATHS.icon192), true);
    assert.equal(isFrigoraPwaPublicPath(FRIGORA_PWA_START_PATH), false);
    assert.equal(isFrigoraPwaPublicPath("/ventures/ven-1/work/assigned"), false);
    assert.equal(isFrigoraPwaPublicPath("/login"), false);
    assert.equal(isFrigoraPwaPublicPath("/dashboard"), false);
    assert.equal(proxy.includes("pwaSession"), false);
    assert.equal(proxy.includes("indexedDB"), false);
    const loginScreen = read("modules/auth/screens.tsx");
    const loginPage = read("app/(auth)/login/page.tsx");
    const nextPath = read("lib/auth/next-path.ts");
    assert.match(loginScreen, /FRIGORA_AUTH_SIGN_IN_TITLE/);
    assert.match(loginScreen, /isFrigoraAuthContinuation/);
    assert.match(loginPage, /generateMetadata/);
    assert.match(nextPath, /isFrigoraPwaPublicPath/);
    assert.equal(isFrigoraAuthContinuation("/frigora"), true);
    assert.equal(FRIGORA_AUTH_SIGN_IN_TITLE, "Sign in to Frigora");
  });

  it("uses an online-only service worker with navigation fallback", () => {
    const sw = readPublic("sw.js");
    const offline = readPublic("offline.html");
    assert.match(sw, /request\.mode !== "navigate"/);
    assert.match(sw, /request\.method !== "GET"/);
    assert.match(sw, /\/offline\.html/);
    assert.equal(sw.includes("indexedDB"), false);
    assert.equal(sw.includes("BackgroundSync"), false);
    assert.equal(sw.includes("/api/"), false);
    for (const phrase of forbiddenOfflineCapability) {
      assert.equal(sw.toLowerCase().includes(phrase.toLowerCase()), false, phrase);
    }
    const offlineText = offline.replace(/\s+/g, " ");
    assert.match(offline, new RegExp(FRIGORA_OFFLINE_PAGE_TITLE));
    assert.match(offline, /already-open Frigora field session/);
    assert.match(offline, /Reconnect, then continue/);
    assert.equal(offlineText.includes(FRIGORA_OFFLINE_PAGE_BODY), true);
  });

  it("does not imply disconnected mutations were saved and blocks them while offline", () => {
    assert.match(
      FRIGORA_CONNECTIVITY_OFFLINE_BODY,
      /Technical findings, field captures, and evidence may be saved/,
    );
    assert.match(FRIGORA_CONNECTIVITY_OFFLINE_BODY, /reconnect alone does not submit/i);
    assert.match(FRIGORA_CONNECTIVITY_RESTORED_BODY, /explicitly submit/i);
    assert.match(FRIGORA_CONNECTIVITY_RESTORED_BODY, /Reconnect alone does not change server records/i);
    assert.match(FRIGORA_EVIDENCE_ONLINE_NOTE, /upload immediately/i);
    assert.match(FRIGORA_EVIDENCE_ONLINE_NOTE, /explicit later submit/i);
    assert.match(FRIGORA_EVIDENCE_ONLINE_NOTE, /Removal and linking still require a connection/i);
    const banner = read("modules/frigora/app/pwa/connectivity-banner.tsx");
    const register = read("modules/frigora/app/pwa/register-service-worker.tsx");
    assert.match(banner, /shouldBlockFrigoraFieldMutation/);
    assert.match(banner, /preventDefault/);
    assert.match(banner, /data-frigora-offline/);
    assert.match(banner, /FRIGORA_CONNECTIVITY_OFFLINE_BODY/);
    assert.match(register, /NODE_ENV !== "production"/);
    assert.equal(banner.includes("will sync"), false);
    assert.equal(banner.includes("saved offline"), false);
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/ven-1/work/assigned"),
      true,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(true, "/ventures/ven-1/work/assigned"),
      false,
    );
  });

  it("preserves the certified field workflow on the visit recorder", () => {
    const recorder = read("modules/frigora/app/screens/visit-recorder-screen.tsx");
    const nav = read("modules/frigora/app/screens/field-workflow-nav.tsx");
    const assigned = read("app/(app)/ventures/[ventureId]/work/assigned/page.tsx");
    const start = read("app/(app)/frigora/page.tsx");
    assert.equal(FRIGORA_FIELD_WORKFLOW_LABEL, "Job → Check → Diagnose → Repair → Prove → Finish");
    assert.match(nav, /FRIGORA_FIELD_WORKFLOW_STEPS/);
    assert.match(recorder, /FieldWorkflowNav/);
    assert.match(recorder, /id="field-job"/);
    assert.match(recorder, /id="field-check"/);
    assert.match(recorder, /id="field-diagnose"/);
    assert.match(recorder, /id="field-repair"/);
    assert.match(recorder, /id="field-prove"/);
    assert.match(recorder, /id="field-finish"/);
    assert.match(recorder, /RecordPartUsageForm/);
    assert.match(recorder, /RecordRefrigerantEventForm/);
    assert.match(recorder, /RecordVisitEvidenceForm/);
    assert.match(assigned, /MyWorkScreen/);
    assert.match(start, /resolveFrigoraPwaStart/);
    assert.match(start, /absolute: FRIGORA_PWA_NAME/);
    assert.equal(recorder.includes("closeWorkOrder"), false);
    assert.equal(recorder.includes("Complete Work Order"), false);
  });

  it("keeps Engineer commercial authority and Visit/WorkOrder lifecycle intact", () => {
    const recorder = read("modules/frigora/app/screens/visit-recorder-screen.tsx");
    const myWork = read("modules/frigora/app/screens/my-work-screen.tsx");
    const workScreens = read("modules/frigora/app/screens/work-screens.tsx");
    const finishVisit = read("modules/frigora/app/forms/finish-visit-form.tsx");
    const workDetailPage = read("app/(app)/ventures/[ventureId]/work/[workOrderId]/page.tsx");
    assert.equal(recorder.includes("TimeMaterialsSection"), false);
    assert.equal(recorder.includes("setVentureLabourHourlyCharge"), false);
    assert.equal(myWork.includes("TimeMaterialsSection"), false);
    assert.equal(myWork.includes("Complete Work Order"), false);
    assert.match(workScreens, /ctx.canWrite && timeMaterials/);
    assert.match(workDetailPage, /includeTimeMaterials: ctx.canWrite/);
    assert.match(finishVisit, /work order stays open/);
    assert.equal(finishVisit.includes("closeWorkOrder"), false);
    assert.match(recorder, /Work order status remains/);
  });

  it("does not change persistence generation or invent F3.3 stores", () => {
    const db = read("platform/persistence/db.ts");
    assert.match(db, /SCHEMA_GENERATION = 29/);
    assert.equal(platformVentureRegistry.resolve("frigora").lifecycle, "concept");
    const sw = readPublic("sw.js");
    assert.equal(sw.includes("workbox"), false);
    assert.equal(sw.includes("CacheFirst"), false);
    assert.equal(sw.includes("indexedDB"), false);
  });

  it("renders Frigora customer shell without VentureOS platform chrome", () => {
    const shell = read("core/shell/os-shell.tsx");
    const topNav = read("core/shell/top-nav.tsx");
    const nav = read("modules/frigora/app/nav.ts");
    assert.match(shell, /isFrigoraCustomerPath/);
    assert.match(shell, /frigoraCustomer \? null : <Sidebar/);
    assert.match(shell, /frigoraCustomer \? null : <CommandPalette/);
    assert.match(topNav, /isFrigoraCustomerPath/);
    assert.match(topNav, /FRIGORA_PWA_NAME/);
    assert.match(topNav, /Field operations/);
    // Platform Ask VentureOS remains only on the non-Frigora TopNav branch
    assert.match(topNav, /Ask VentureOS/);
    const frigoraToolbar = topNav.slice(
      topNav.indexOf("if (frigoraCustomer)"),
      topNav.indexOf("return (", topNav.indexOf("if (frigoraCustomer)") + 1),
    );
    assert.equal(frigoraToolbar.includes("Ask VentureOS"), false);
    assert.equal(frigoraToolbar.includes("WorkspaceSwitcher"), false);
    assert.equal(frigoraToolbar.includes("VentureSwitcher"), false);
    assert.match(nav, /definitionId === "frigora"/);
    const afterFrigoraGate = nav.slice(nav.indexOf('definitionId === "frigora"'));
    const frigoraReturnBlock = afterFrigoraGate.slice(
      afterFrigoraGate.indexOf("return ["),
      afterFrigoraGate.indexOf("];") + 2,
    );
    assert.equal(frigoraReturnBlock.includes("Company HQ"), false);
    assert.equal(frigoraReturnBlock.includes("Executive Office"), false);
    assert.equal(frigoraReturnBlock.includes("Documents"), false);
    assert.match(frigoraReturnBlock, /Operations/);
    assert.match(frigoraReturnBlock, /Catalogue/);
  });

  it("keeps Frigora document titles and login copy free of VentureOS", () => {
    const identity = read("modules/frigora/app/pwa/identity.ts");
    const copy = read("modules/frigora/app/pwa/copy.ts");
    const loginScreen = read("modules/auth/screens.tsx");
    const loginPage = read("app/(auth)/login/page.tsx");
    const ventureLayout = read("app/(app)/ventures/[ventureId]/layout.tsx");
    const rootLayout = read("app/layout.tsx");
    const authCopy = read("modules/auth/presentation/copy.ts");

    assert.equal(FRIGORA_DOCUMENT_TITLE_TEMPLATE, "%s · Frigora");
    assert.equal(FRIGORA_DOCUMENT_TITLE_TEMPLATE.includes("VentureOS"), false);
    assert.match(identity, /absolute: FRIGORA_PWA_NAME/);
    assert.match(identity, /template: FRIGORA_DOCUMENT_TITLE_TEMPLATE/);
    assert.equal(identity.includes("default: FRIGORA_PWA_NAME"), false);

    assert.match(loginPage, /absolute: FRIGORA_AUTH_SIGN_IN_TITLE/);
    assert.equal(FRIGORA_AUTH_SIGN_IN_TITLE, "Sign in to Frigora");
    assert.equal(FRIGORA_AUTH_SIGN_IN_TITLE.includes("VentureOS"), false);

    assert.match(loginScreen, /FRIGORA_AUTH_TRUST_NOTES/);
    assert.match(
      loginScreen,
      /frigora \? null : \(\s*<AuthMutedLine>\s*New to VentureOS\?/,
    );
    assert.equal(
      FRIGORA_AUTH_TRUST_NOTES.some((note) => note.includes("VentureOS")),
      false,
    );
    assert.match(copy, /FRIGORA_AUTH_TRUST_NOTES/);

    // Generic platform login identity preserved outside Frigora continuation
    assert.match(
      authCopy,
      /VentureOS is a private operating environment/,
    );
    assert.match(authCopy, /TRUST_NOTES/);
    assert.match(loginScreen, /New to VentureOS\?/);
    assert.match(rootLayout, /template: "%s · VentureOS"/);
    assert.match(rootLayout, /applicationName: "VentureOS"/);

    // Frigora venture routes adopt Frigora metadata; non-Frigora leave root identity
    assert.match(ventureLayout, /isFrigoraVenture/);
    assert.match(ventureLayout, /frigoraCustomerFacingMetadata/);
    assert.match(ventureLayout, /generateMetadata/);
  });

  it("keeps Frigora continuation loading free of VentureOS identity", () => {
    const authLoading = read("app/(auth)/loading.tsx");
    const routeLoading = read("modules/frigora/app/pwa/auth-route-loading.tsx");
    const executiveLoading = read("core/shell/executive-loading.tsx");
    const shell = read("modules/auth/presentation/shell.tsx");
    const rootLoading = read("app/loading.tsx");

    assert.match(authLoading, /FrigoraAwareAuthRouteLoading/);
    assert.equal(authLoading.includes("Opening the desk"), false);
    assert.equal(authLoading.includes("VentureOS"), false);

    assert.match(routeLoading, /isFrigoraAuthContinuation/);
    assert.match(routeLoading, /FRIGORA_AUTH_LOADING_MESSAGE/);
    assert.match(routeLoading, /FRIGORA_PWA_NAME/);
    assert.match(routeLoading, /Opening the desk/);
    assert.match(routeLoading, /productName=""/);
    assert.equal(FRIGORA_AUTH_LOADING_MESSAGE, "Opening Frigora...");
    assert.equal(FRIGORA_AUTH_LOADING_MESSAGE.includes("VentureOS"), false);

    const frigoraBranch = routeLoading.slice(
      routeLoading.indexOf("if (isFrigoraAuthContinuation"),
      routeLoading.indexOf("return <ExecutiveLoading message=\"Opening the desk"),
    );
    assert.equal(frigoraBranch.includes("VentureOS"), false);
    assert.match(frigoraBranch, /FRIGORA_PWA_NAME/);
    assert.match(frigoraBranch, /FRIGORA_AUTH_LOADING_MESSAGE/);

    assert.match(executiveLoading, /productName = "VentureOS"/);
    assert.match(executiveLoading, /aria-live="polite"/);
    assert.match(executiveLoading, /role="status"/);
    assert.match(executiveLoading, /announcement/);

    // Suspense fallbacks must not flash VentureOS during Frigora continuation
    assert.match(shell, /NeutralAuthExperiencePanel/);
    assert.match(shell, /NeutralAuthIdentity/);
    assert.match(shell, /NeutralAuthExperienceBand/);
    assert.equal(shell.includes("AUTH_PRODUCT_NAME"), false);
    assert.equal(shell.includes("AUTH_MARK"), false);

    // Root loading is identity-unknown — must stay neutral (OBS-005)
    assert.match(rootLoading, /productName=""/);
    assert.match(rootLoading, /Opening\.\.\./);
    assert.equal(rootLoading.includes("VentureOS"), false);
    assert.equal(rootLoading.includes("Opening VentureOS"), false);
  });

  it("keeps authenticated Frigora app loading free of VentureOS identity", () => {
    const appLoading = read("app/(app)/loading.tsx");
    const venturesLoading = read("app/(app)/ventures/loading.tsx");
    const routeLoading = read("modules/frigora/app/pwa/app-route-loading.tsx");
    const dashboardLoading = read("app/(app)/dashboard/loading.tsx");
    const workLoading = read("app/(app)/ventures/[ventureId]/work/loading.tsx");
    const customersLoading = read(
      "app/(app)/ventures/[ventureId]/customers/loading.tsx",
    );

    assert.match(appLoading, /FrigoraAwareAppRouteLoading/);
    assert.equal(appLoading.includes("VentureOS"), false);
    assert.equal(appLoading.includes("Executive Workspace"), false);

    assert.match(venturesLoading, /FrigoraAwareAppRouteLoading/);
    assert.equal(venturesLoading.includes("VentureOS"), false);
    assert.match(venturesLoading, /Loading Company Context/);

    assert.match(routeLoading, /isFrigoraCustomerPath/);
    assert.match(routeLoading, /FRIGORA_PWA_NAME/);
    assert.match(routeLoading, /FRIGORA_AUTH_LOADING_MESSAGE/);
    assert.match(routeLoading, /Synchronising Executive Workspace/);
    assert.match(routeLoading, /productName=""/);
    assert.match(routeLoading, /platformMessage/);

    const frigoraBranch = routeLoading.slice(
      routeLoading.indexOf("if (isFrigoraCustomerPath"),
      routeLoading.indexOf("return <ExecutiveLoading message={platformMessage}"),
    );
    assert.equal(frigoraBranch.includes("VentureOS"), false);
    assert.match(frigoraBranch, /FRIGORA_PWA_NAME/);
    assert.match(frigoraBranch, /FRIGORA_AUTH_LOADING_MESSAGE/);

    // Segment loaders under Frigora customer routes stay product-neutral
    assert.equal(workLoading.includes("VentureOS"), false);
    assert.equal(customersLoading.includes("VentureOS"), false);
    assert.match(workLoading, /Loading work/);
    assert.match(customersLoading, /Loading customers/);

    // Non-Frigora authenticated platform loading may remain VentureOS-branded
    assert.match(dashboardLoading, /ExecutiveLoading/);
    assert.match(dashboardLoading, /Preparing Executive Intelligence/);
  });

  it("keeps Frigora WorkOrder/Visit hard-entry loading free of VentureOS", () => {
    const rootLoading = read("app/loading.tsx");
    const appLoading = read("app/(app)/loading.tsx");
    const venturesLoading = read("app/(app)/ventures/loading.tsx");
    const workLoading = read("app/(app)/ventures/[ventureId]/work/loading.tsx");
    const routeLoading = read("modules/frigora/app/pwa/app-route-loading.tsx");
    const executiveLoading = read("core/shell/executive-loading.tsx");
    const loginPage = read("app/(auth)/login/page.tsx");
    const authCopy = read("modules/auth/presentation/copy.ts");

    // Hard entry to WO/Visit can flash root → (app) → ventures → work loaders
    assert.equal(rootLoading.includes("Opening VentureOS"), false);
    assert.equal(rootLoading.includes("VentureOS"), false);
    assert.equal(appLoading.includes("VentureOS"), false);
    assert.equal(venturesLoading.includes("VentureOS"), false);
    assert.equal(workLoading.includes("VentureOS"), false);

    assert.match(rootLoading, /productName=""/);
    assert.match(rootLoading, /message="Opening\.\.\."/);
    assert.match(appLoading, /FrigoraAwareAppRouteLoading/);
    assert.match(venturesLoading, /FrigoraAwareAppRouteLoading/);
    assert.equal(workLoading.includes("VentureOS"), false);

    // Known Frigora context still brands Frigora (not VentureOS)
    assert.match(routeLoading, /FRIGORA_PWA_NAME/);
    assert.match(routeLoading, /FRIGORA_AUTH_LOADING_MESSAGE/);
    assert.equal(FRIGORA_AUTH_LOADING_MESSAGE, "Opening Frigora...");

    // Accessibility semantics preserved on shared loader
    assert.match(executiveLoading, /role="status"/);
    assert.match(executiveLoading, /aria-live="polite"/);
    assert.match(executiveLoading, /aria-busy="true"/);
    assert.match(executiveLoading, /announcement/);
    assert.match(
      executiveLoading,
      /productName \? `\$\{productName\}\. \$\{message\}` : message/,
    );

    // Settled generic platform login identity remains VentureOS
    assert.match(authCopy, /AUTH_PRODUCT_NAME = "VentureOS"/);
    assert.match(loginPage, /title: "Sign in"/);
  });
});
