import { existsSync, lstatSync, realpathSync, rmSync } from "node:fs";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { expiredAuthCookieOptions, sessionCookieOptions, workspaceCookieOptions } from "@/lib/auth/session-cookie";
import {
  PersistentDevelopmentDatabaseError,
  inspectPersistentDevelopmentDatabase,
} from "@/platform/persistence/persistent-dev-database";

/**
 * One public origin for the first customer hostname.
 * A second application hostname is a later Control packet.
 */
export const INITIAL_PUBLIC_ORIGIN = "https://frigora.ventureoperatingsystem.co.za";

/**
 * The 15-second scheduler lives inside the Next.js process.
 * A second process would run a second scheduler against the same SQLite file.
 * Locking the file in application code does not stop that second process.
 * The host must run exactly one replica.
 */
export const PRODUCTION_RUNTIME_REQUIREMENT = {
  applicationInstances: 1,
  scheduler: "in-process",
  schedulerIntervalMs: 15_000,
  enforcement: "hosting",
} as const;

const DEV_AUTH_SECRET = "ventureos-dev-secret-change-me";
const MINIMUM_AUTH_SECRET_LENGTH = 32;

export class ProductionProcessError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "ProductionProcessError";
    this.code = code;
  }
}

export function productionProcessEnabled() {
  return process.env.NODE_ENV === "production";
}

export function assertProductionStartup() {
  if (!productionProcessEnabled()) return;
  assertProductionDatabaseUrl(process.env.DATABASE_URL ?? "");
  assertProductionObjectRoot();
  assertProductionAuth();
  assertProductionCookies();
}

export function assertProductionDatabaseUrl(selectedUrl: string) {
  if (!productionProcessEnabled()) return;
  const configured = process.env.DATABASE_URL?.trim() ?? "";
  if (!configured) {
    throw new ProductionProcessError("production_database_url_missing");
  }
  const selectedPath = canonicalFilePath(selectedUrl);
  const configuredPath = canonicalFilePath(configured);
  if (!samePath(selectedPath, configuredPath)) {
    throw new ProductionProcessError("production_database_selection_mismatch");
  }
  refuseProtectedDatabasePath(selectedPath);
  const root = requiredVolumeRoot();
  const located = locateInsideVolume(root, selectedPath);
  if (existsSync(located)) {
    const listing = safeLstat(located, "production_database_symlink_refused");
    if (listing.isSymbolicLink()) {
      throw new ProductionProcessError("production_database_symlink_refused");
    }
    if (!listing.isFile()) {
      throw new ProductionProcessError("production_database_url_malformed");
    }
  }
}

/** Location rules for a new demonstration file. The file and its sidecar must be absent. */
export function assertDemonstrationDatabaseTarget(databaseUrl: string) {
  assertProductionDatabaseUrl(databaseUrl);
  const filePath = canonicalFilePath(databaseUrl);
  if (existsSync(filePath) || existsSync(`${filePath}.ventureos-identity`) || existsSync(`${filePath}.ventureos-init.lock`)) {
    throw new ProductionProcessError("demonstration_database_exists");
  }
}

/** Object directory location. Creates nothing. An existing directory must be a real empty directory. */
export function assertDemonstrationObjectTarget(objectDirectory: string) {
  if (!productionProcessEnabled()) {
    throw new ProductionProcessError("demonstration_production_contract_required");
  }
  const resolved = resolve(objectDirectory);
  refuseWorktreeObjectRoot(resolved);
  const root = requiredVolumeRoot();
  const located = locateInsideVolume(root, resolved);
  refuseWorktreeObjectRoot(located);
  if (!existsSync(located)) return located;
  const listing = safeLstat(located, "production_object_root_invalid");
  if (listing.isSymbolicLink() || !listing.isDirectory()) {
    throw new ProductionProcessError("production_object_root_symlink_refused");
  }
  const real = safeRealpath(located, "production_object_root_invalid");
  if (!samePath(real, located) || !isInside(root, real)) {
    throw new ProductionProcessError("production_object_root_invalid");
  }
  return real;
}

/**
 * Backup may open only the configured demonstration database.
 * Path checks run before identity inspection, so a protected or escaped source is not opened.
 */
export function assertDemonstrationBackupSource() {
  if (!productionProcessEnabled()) {
    throw new ProductionProcessError("demonstration_production_contract_required");
  }
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  assertProductionDatabaseReadyToOpen(databaseUrl);
  const filePath = canonicalFilePath(databaseUrl);
  const sidecar = `${filePath}.ventureos-identity`;
  if (!existsSync(sidecar)) {
    throw new ProductionProcessError("demonstration_backup_invalid");
  }
  const sidecarListing = safeLstat(sidecar, "production_database_symlink_refused");
  if (sidecarListing.isSymbolicLink() || !sidecarListing.isFile()) {
    throw new ProductionProcessError("production_database_symlink_refused");
  }
  inspectPersistentDevelopmentDatabase(databaseUrl);
  return filePath;
}

/**
 * Restore may write only a new database and object directory inside the authorised volume.
 * Existing files, sidecars, locks, protected names, and link escapes are refused before writing.
 */
export function assertDemonstrationRestoreTarget(databasePath: string, objectDirectory: string) {
  if (!productionProcessEnabled()) {
    throw new ProductionProcessError("demonstration_production_contract_required");
  }
  const root = requiredVolumeRoot();
  const databaseCandidate = resolve(databasePath);
  const objectCandidate = resolve(objectDirectory);
  refuseProtectedDatabasePath(databaseCandidate);
  refuseWorktreeObjectRoot(objectCandidate);
  const locatedDatabase = locateInsideVolume(root, databaseCandidate);
  const locatedObjects = locateInsideVolume(root, objectCandidate);
  refuseProtectedDatabasePath(locatedDatabase);
  refuseWorktreeObjectRoot(locatedObjects);
  if (
    samePath(locatedDatabase, locatedObjects) ||
    isInside(locatedDatabase, locatedObjects) ||
    isInside(locatedObjects, locatedDatabase)
  ) {
    throw new ProductionProcessError("production_database_url_malformed");
  }
  if (
    existsSync(locatedDatabase) ||
    existsSync(`${locatedDatabase}.ventureos-identity`) ||
    existsSync(`${locatedDatabase}.ventureos-init.lock`) ||
    existsSync(locatedObjects)
  ) {
    throw new ProductionProcessError("demonstration_restore_exists");
  }
  return { databasePath: locatedDatabase, objectDirectory: locatedObjects };
}

/** Unpublished backup directories use this prefix and are not valid restore sources. */
export const DEMONSTRATION_BACKUP_STAGE_PREFIX = ".backup-stage-";

/** Backup output must be a new directory inside the authorised volume. */
export function assertDemonstrationBackupDestination(destination: string) {
  if (!productionProcessEnabled()) {
    throw new ProductionProcessError("demonstration_production_contract_required");
  }
  const root = requiredVolumeRoot();
  const located = locateInsideVolume(root, resolve(destination));
  if (basename(located).startsWith(DEMONSTRATION_BACKUP_STAGE_PREFIX)) {
    throw new ProductionProcessError("production_path_outside_storage_root");
  }
  if (existsSync(located)) {
    const listing = safeLstat(located, "production_path_symlink_refused");
    if (listing.isSymbolicLink()) throw new ProductionProcessError("production_path_symlink_refused");
    throw new ProductionProcessError("demonstration_backup_exists");
  }
  refuseBackupAlias(located);
  return { root, destination: located };
}

/** Staging stays inside the volume and cannot be given a published backup name. */
export function assertDemonstrationBackupStage(stage: string) {
  if (!productionProcessEnabled()) {
    throw new ProductionProcessError("demonstration_production_contract_required");
  }
  const root = requiredVolumeRoot();
  const located = locateInsideVolume(root, resolve(stage));
  if (!basename(located).startsWith(DEMONSTRATION_BACKUP_STAGE_PREFIX)) {
    throw new ProductionProcessError("production_database_url_malformed");
  }
  if (existsSync(located)) throw new ProductionProcessError("demonstration_backup_exists");
  return located;
}

/** Removes a stage directory only when it is a real directory inside the volume. */
export function removeDemonstrationBackupStage(stage: string) {
  if (!existsSync(stage)) return;
  try {
    const root = requiredVolumeRoot();
    const located = locateInsideVolume(root, resolve(stage));
    const listing = safeLstat(located, "demonstration_backup_cleanup_failed");
    if (listing.isSymbolicLink() || !listing.isDirectory()) {
      throw new ProductionProcessError("demonstration_backup_cleanup_failed");
    }
    const real = safeRealpath(located, "demonstration_backup_cleanup_failed");
    if (!samePath(real, located) || !isInside(root, real) || !basename(real).startsWith(DEMONSTRATION_BACKUP_STAGE_PREFIX)) {
      throw new ProductionProcessError("demonstration_backup_cleanup_failed");
    }
    rmSync(located, { recursive: true, force: true });
  } catch (error) {
    if (error instanceof ProductionProcessError && error.code === "demonstration_backup_cleanup_failed") throw error;
    throw new ProductionProcessError("demonstration_backup_cleanup_failed");
  }
  if (existsSync(stage)) throw new ProductionProcessError("demonstration_backup_cleanup_failed");
}

function refuseBackupAlias(destination: string) {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (databaseUrl.startsWith("file:")) {
    const databasePath = canonicalFilePath(databaseUrl);
    if (samePath(destination, databasePath)) {
      throw new ProductionProcessError("production_database_url_malformed");
    }
  }
  const objectRoot = process.env.STORED_OBJECT_ROOT?.trim() ?? "";
  if (!objectRoot) return;
  const objectCandidate = resolve(objectRoot);
  if (samePath(destination, objectCandidate) || isInside(objectCandidate, destination)) {
    throw new ProductionProcessError("production_database_url_malformed");
  }
}

/** Configuration may describe a file that is not created yet. Opening one is refused. */
export function assertProductionDatabaseReadyToOpen(selectedUrl: string) {
  if (!productionProcessEnabled()) return;
  assertProductionDatabaseUrl(selectedUrl);
  const filePath = canonicalFilePath(selectedUrl);
  if (!existsSync(filePath)) {
    throw new ProductionProcessError("production_database_unavailable");
  }
}

export function assertProductionObjectRoot() {
  if (!productionProcessEnabled()) return resolveStoredObjectRootUnchecked();
  const configured = process.env.STORED_OBJECT_ROOT?.trim() ?? "";
  if (!configured) {
    throw new ProductionProcessError("production_object_root_missing");
  }
  const resolved = resolve(configured);
  refuseWorktreeObjectRoot(resolved);
  const root = requiredVolumeRoot();
  const located = locateInsideVolume(root, resolved);
  refuseWorktreeObjectRoot(located);
  const listing = safeLstat(located, "production_object_root_invalid");
  if (listing.isSymbolicLink()) {
    throw new ProductionProcessError("production_object_root_symlink_refused");
  }
  if (!listing.isDirectory()) {
    throw new ProductionProcessError("production_object_root_invalid");
  }
  const real = safeRealpath(located, "production_object_root_invalid");
  if (!samePath(real, located) || !isInside(root, real)) {
    throw new ProductionProcessError("production_object_root_invalid");
  }
  return real;
}

export function assertProductionAuth() {
  if (!productionProcessEnabled()) return;
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.trim().length < MINIMUM_AUTH_SECRET_LENGTH || secret === DEV_AUTH_SECRET) {
    throw new ProductionProcessError("production_auth_secret_missing");
  }
  resolvePublicAppOrigin({
    nodeEnv: "production",
    authUrl: process.env.AUTH_URL,
    forwardedHost: null,
    forwardedProto: null,
    host: null,
  });
}

export function resolvePublicAppOrigin(input: {
  nodeEnv: string | undefined;
  authUrl: string | undefined;
  forwardedHost: string | null;
  forwardedProto: string | null;
  host: string | null;
}) {
  if (input.nodeEnv === "production") {
    return requiredProductionAuthUrl(input.authUrl);
  }
  if (input.authUrl) {
    return input.authUrl.replace(/\/$/, "");
  }
  const host = input.forwardedHost ?? input.host;
  const proto = input.forwardedProto ?? "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export function assessLiveness() {
  return { httpStatus: 200, body: { status: "live" as const } };
}

export function assessReadiness() {
  if (!productionProcessEnabled()) {
    return { httpStatus: 200, body: { status: "ready" as const } };
  }
  try {
    assertProductionStartup();
    assertProductionDatabaseFilePresent();
    inspectPersistentDevelopmentDatabase(process.env.DATABASE_URL ?? "");
  } catch (error) {
    return {
      httpStatus: 503,
      body: { status: "not_ready" as const, reason: readinessReason(error) },
    };
  }
  return { httpStatus: 200, body: { status: "ready" as const } };
}

function assertProductionDatabaseFilePresent() {
  const configured = process.env.DATABASE_URL?.trim() ?? "";
  const filePath = canonicalFilePath(configured);
  if (!existsSync(filePath)) {
    throw new ProductionProcessError("production_database_unavailable");
  }
  const listing = safeLstat(filePath, "production_database_unavailable");
  if (listing.isSymbolicLink() || !listing.isFile()) {
    throw new ProductionProcessError("production_database_unavailable");
  }
}

function assertProductionCookies() {
  const session = sessionCookieOptions(false);
  const workspace = workspaceCookieOptions();
  const expired = expiredAuthCookieOptions();
  for (const options of [session, workspace, expired]) {
    if (
      options.httpOnly !== true ||
      options.sameSite !== "lax" ||
      options.secure !== true ||
      options.path !== "/" ||
      "domain" in options
    ) {
      throw new ProductionProcessError("production_cookie_contract_failed");
    }
  }
}

function requiredProductionAuthUrl(authUrl: string | undefined) {
  const configured = authUrl?.trim() ?? "";
  if (!configured) throw new ProductionProcessError("production_auth_url_missing");
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new ProductionProcessError("production_auth_url_invalid");
  }
  const normalised = `${parsed.protocol}//${parsed.host}`;
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== "/" && parsed.pathname !== "") ||
    normalised !== INITIAL_PUBLIC_ORIGIN
  ) {
    throw new ProductionProcessError("production_auth_url_invalid");
  }
  return INITIAL_PUBLIC_ORIGIN;
}

function requiredVolumeRoot() {
  const configured = process.env.VENTUREOS_PERSISTENT_ROOT?.trim() ?? "";
  if (!configured) throw new ProductionProcessError("production_storage_root_missing");
  const resolved = resolve(configured);
  if (!existsSync(resolved)) throw new ProductionProcessError("production_storage_root_invalid");
  const listing = safeLstat(resolved, "production_storage_root_invalid");
  if (listing.isSymbolicLink()) {
    throw new ProductionProcessError("production_storage_root_symlink_refused");
  }
  if (!listing.isDirectory()) {
    throw new ProductionProcessError("production_storage_root_invalid");
  }
  const real = safeRealpath(resolved, "production_storage_root_invalid");
  if (!samePath(real, resolved)) {
    throw new ProductionProcessError("production_storage_root_invalid");
  }
  return real;
}

function canonicalFilePath(url: string) {
  if (
    !url.startsWith("file:") ||
    url === "file:" ||
    url.includes("?") ||
    url.includes("#") ||
    url.includes("\0") ||
    url.startsWith("file::memory:") ||
    url === ":memory:"
  ) {
    throw new ProductionProcessError("production_database_url_malformed");
  }
  const filePath = resolve(url.slice("file:".length));
  if (!isAbsolute(filePath)) {
    throw new ProductionProcessError("production_database_url_malformed");
  }
  return filePath;
}

function refuseProtectedDatabasePath(filePath: string) {
  const folded = filePath.toLowerCase();
  const dataFile = `${sep}data${sep}ventureos.db`.toLowerCase();
  const webData = `${sep}apps${sep}web${sep}data${sep}`.toLowerCase();
  if (
    folded.endsWith(dataFile) ||
    folded.endsWith(`${sep}ventureos.db`) ||
    folded.includes(webData) ||
    folded.includes("ventureos-frigora-f34-04") ||
    folded.includes("frg-demo-env-02") ||
    folded.includes("frg-r1-v2-hosted")
  ) {
    throw new ProductionProcessError("production_database_protected_path_refused");
  }
}

function refuseWorktreeObjectRoot(filePath: string) {
  const folded = filePath.toLowerCase();
  const worktreeObjects = `${sep}data${sep}objects`.toLowerCase();
  if (folded.endsWith(worktreeObjects) || folded.includes(`${sep}apps${sep}web${sep}data${sep}`)) {
    throw new ProductionProcessError("production_object_root_worktree_refused");
  }
}

function locateInsideVolume(root: string, candidate: string) {
  const lexical = resolve(candidate);
  if (!isInside(root, lexical)) {
    throw new ProductionProcessError("production_path_outside_storage_root");
  }
  const parts = relative(root, lexical).split(sep).filter(Boolean);
  let current = root;
  for (const part of parts) {
    if (part === "." || part === "..") {
      throw new ProductionProcessError("production_path_outside_storage_root");
    }
    const next = resolve(current, part);
    if (!isInside(root, next)) {
      throw new ProductionProcessError("production_path_outside_storage_root");
    }
    if (!existsSync(next)) {
      current = next;
      continue;
    }
    const listing = safeLstat(next, "production_path_symlink_refused");
    if (listing.isSymbolicLink()) {
      throw new ProductionProcessError("production_path_symlink_refused");
    }
    const real = safeRealpath(next, "production_path_symlink_refused");
    if (!samePath(real, next) || !isInside(root, real)) {
      throw new ProductionProcessError("production_path_outside_storage_root");
    }
    current = real;
  }
  if (!isInside(root, current)) {
    throw new ProductionProcessError("production_path_outside_storage_root");
  }
  return current;
}

function safeLstat(filePath: string, code: string) {
  try {
    return lstatSync(filePath);
  } catch {
    throw new ProductionProcessError(code);
  }
}

function safeRealpath(filePath: string, code: string) {
  try {
    const real = realpathSync(filePath);
    if (lstatSync(real).isSymbolicLink()) {
      throw new ProductionProcessError(code);
    }
    return real;
  } catch (error) {
    if (error instanceof ProductionProcessError) throw error;
    throw new ProductionProcessError(code);
  }
}

function isInside(root: string, candidate: string) {
  const fromRoot = relative(root, candidate);
  if (fromRoot === "" || isAbsolute(fromRoot)) return false;
  const parts = fromRoot.split(sep);
  return parts.length > 0 && parts.every((part) => part !== ".." && part !== "");
}

function samePath(left: string, right: string) {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function readinessReason(error: unknown) {
  const code = error instanceof ProductionProcessError || error instanceof PersistentDevelopmentDatabaseError
    ? error.code
    : "";
  if (code.includes("database")) return "database_unavailable";
  if (code.includes("object") || code.includes("storage") || code.includes("path")) return "storage_unavailable";
  if (code.includes("auth") || code.includes("cookie")) return "auth_unavailable";
  return "configuration_unavailable";
}

function resolveStoredObjectRootUnchecked() {
  const configured = process.env.STORED_OBJECT_ROOT?.trim();
  if (configured) return resolve(configured);
  return resolve(process.cwd(), "data/objects");
}
