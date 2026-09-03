import { RUNTIME_REQUIRED_CAPABILITIES } from "../capability/types";
import { platformCapabilityRegistry } from "../capability/catalog";
import { createVentureManifest } from "./model";
import { createVentureDefinitionRegistry } from "./registry";
import type { VentureDefinitionManifest } from "./types";
import { VENTURE_RUNTIME_ORCHESTRATOR } from "./types";

const runtimeRequired = [...RUNTIME_REQUIRED_CAPABILITIES];

const sharedUses = [
  ...runtimeRequired,
  "platform.capability-framework",
  "platform.identity",
  "data.venture-genome",
  "intelligence.executive-memory",
  "intelligence.company-story",
  "intelligence.decision-engine",
  "intelligence.risk",
  "intelligence.mission",
  "governance.executive-office",
  "governance.founder-decision",
];

const sharedRuntime = {
  orchestrator: VENTURE_RUNTIME_ORCHESTRATOR,
  requiredCapabilities: runtimeRequired,
};

const sharedGovernance = {
  owner: "founder",
  policyCapabilityId: "intelligence.policy-engine",
  decisionCapabilityId: "governance.founder-decision",
  officeCapabilityId: "governance.executive-office",
};

export const platformVentureCatalog: VentureDefinitionManifest[] = [
  createVentureManifest({
    id: "qualora",
    name: "Qualora",
    purpose: "Quality and evidence operations for regulated work.",
    description:
      "Qualora runs on VentureOS to keep quality constraints, findings and founder calls in one intelligence document.",
    owner: "founder",
    version: "0.3.0",
    lifecycle: "incubating",
    maturity: "alpha",
    runtimeProfile: sharedRuntime,
    capabilityProfile: {
      uses: [...sharedUses, "intelligence.briefing"],
      excludes: [],
    },
    governanceProfile: sharedGovernance,
    dependencies: [],
    supportedFeatures: [
      "situation-room",
      "company-hq",
      "executive-office",
      "founder-decisions",
      "morning-briefing",
      "portfolio",
    ],
    excludedFeatures: [],
  }),
  createVentureManifest({
    id: "calviora",
    name: "Calviora",
    purpose: "Livestock operating cadence and calving-season constraint management.",
    description:
      "Calviora uses VentureOS mission, risk and health without a morning briefing surface.",
    owner: "founder",
    version: "0.1.0",
    lifecycle: "concept",
    maturity: "experimental",
    runtimeProfile: sharedRuntime,
    capabilityProfile: {
      uses: [...sharedUses],
      excludes: ["intelligence.briefing"],
    },
    governanceProfile: sharedGovernance,
    dependencies: [],
    supportedFeatures: [
      "situation-room",
      "company-hq",
      "executive-office",
      "founder-decisions",
      "portfolio",
    ],
    excludedFeatures: ["morning-briefing"],
  }),
  createVentureManifest({
    id: "farmora",
    name: "Farmora",
    purpose: "Farm operations intelligence: genome, mission and field-level health.",
    description:
      "Farmora is a VentureOS venture focused on operating health and knowledge, without an executive office floor.",
    owner: "founder",
    version: "0.1.0",
    lifecycle: "concept",
    maturity: "experimental",
    runtimeProfile: sharedRuntime,
    capabilityProfile: {
      uses: [...sharedUses, "intelligence.briefing"],
      excludes: [],
    },
    governanceProfile: sharedGovernance,
    dependencies: [],
    supportedFeatures: [
      "situation-room",
      "company-hq",
      "founder-decisions",
      "morning-briefing",
      "portfolio",
    ],
    excludedFeatures: ["executive-office"],
  }),
  createVentureManifest({
    id: "frigora",
    name: "Frigora",
    purpose: "Refrigeration operations for companies that run on VentureOS.",
    description:
      "Frigora is a VentureOS venture. Customer, Site, Asset, WorkOrder identity, current WorkOrder assignment, Visit attendance identity, Visit field capture, Visit technical findings, Visit corrective actions, Visit outcomes, Visit recommended actions, Visit refrigerant events, Visit part usages, Asset history projection, Asset operational condition assertions, Visit customer acknowledgements, and Visit evidence are part of this definition version. Work execution, dispatch, full diagnosis workflow, root cause, full repair workflow, parts catalogue, inventory, cylinder inventory, PPM, commercial operations, FACT → PATTERN → SIGNAL, and employee agents are not.",
    owner: "founder",
    version: "0.16.0",
    lifecycle: "concept",
    maturity: "experimental",
    runtimeProfile: sharedRuntime,
    capabilityProfile: {
      uses: [...sharedUses, "intelligence.briefing"],
      excludes: [],
    },
    governanceProfile: sharedGovernance,
    dependencies: [],
    supportedFeatures: [
      "situation-room",
      "company-hq",
      "executive-office",
      "founder-decisions",
      "morning-briefing",
      "portfolio",
    ],
    excludedFeatures: [],
  }),
  createVentureManifest({
    id: "ventureos.company",
    name: "VentureOS Company",
    purpose: "Default company definition for founder-created companies on VentureOS.",
    description:
      "A generic company instance uses the Executive Intelligence Runtime and the shared intelligence pack.",
    owner: "platform",
    version: "1.0.0",
    lifecycle: "operating",
    maturity: "ga",
    runtimeProfile: sharedRuntime,
    capabilityProfile: {
      uses: [...sharedUses, "intelligence.briefing"],
      excludes: [],
    },
    governanceProfile: sharedGovernance,
    dependencies: [],
    supportedFeatures: [
      "situation-room",
      "company-hq",
      "executive-office",
      "founder-decisions",
      "morning-briefing",
      "portfolio",
    ],
    excludedFeatures: [],
  }),
];

export const platformVentureRegistry = createVentureDefinitionRegistry(
  platformVentureCatalog,
  platformCapabilityRegistry,
);
