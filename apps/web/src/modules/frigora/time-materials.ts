import type {
  FrigoraPartUsage,
  FrigoraRefrigerantEvent,
  FrigoraVisit,
} from "@/modules/frigora/types";

/** Integer ZAR minor units (cents). R 1.00 = 100. */
export type ZarCents = number;

export type FrigoraTimeMaterialsCompleteness = "complete" | "incomplete";

export type FrigoraTimeMaterialsLabourLine = {
  visitId: string;
  durationSeconds: number;
  labourHourlyChargeCents: ZarCents | null;
  amountCents: ZarCents | null;
  priced: boolean;
};

export type FrigoraTimeMaterialsPartLine = {
  partUsageId: string;
  quantity: number;
  unitChargeCents: ZarCents | null;
  amountCents: ZarCents | null;
  priced: boolean;
  label: string;
};

export type FrigoraTimeMaterialsRefrigerantLine = {
  refrigerantEventId: string;
  eventKind: FrigoraRefrigerantEvent["eventKind"];
  quantityKg: number;
  chargePerKgCents: ZarCents | null;
  amountCents: ZarCents;
  priced: boolean;
  chargeable: boolean;
  label: string;
};

export type FrigoraTimeMaterialsUnpricedItem = {
  kind: "labour" | "part" | "refrigerant";
  evidenceId: string;
  label: string;
};

export type FrigoraTimeMaterialsSummary = {
  labourLines: FrigoraTimeMaterialsLabourLine[];
  partLines: FrigoraTimeMaterialsPartLine[];
  refrigerantLines: FrigoraTimeMaterialsRefrigerantLine[];
  labourCents: ZarCents;
  partsCents: ZarCents;
  refrigerantCents: ZarCents;
  knownSubtotalCents: ZarCents;
  completeness: FrigoraTimeMaterialsCompleteness;
  /** Present only when completeness === "complete". */
  totalCents: ZarCents | null;
  unpriced: FrigoraTimeMaterialsUnpricedItem[];
};

export function isValidZarCents(value: unknown): value is ZarCents {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Deterministic non-negative cent rounding for quantity × rate. */
export function roundChargeCents(quantity: number, rateCents: ZarCents): ZarCents {
  if (!Number.isFinite(quantity) || quantity < 0 || !isValidZarCents(rateCents)) {
    throw new RangeError("Invalid quantity or rate for charge rounding.");
  }
  return Math.round(quantity * rateCents);
}

/** Labour = round(durationSeconds × hourlyRateCents / 3600). */
export function labourChargeCents(
  durationSeconds: number,
  hourlyRateCents: ZarCents,
): ZarCents {
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0 ||
    !isValidZarCents(hourlyRateCents)
  ) {
    throw new RangeError("Invalid duration or labour rate for charge rounding.");
  }
  return Math.round((durationSeconds * hourlyRateCents) / 3600);
}

export function visitDurationSeconds(arrivedAt: string, departedAt: string): number {
  const start = Date.parse(arrivedAt);
  const end = Date.parse(departedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new RangeError("Invalid visit duration timestamps.");
  }
  return Math.floor((end - start) / 1000);
}

export function formatZarCents(cents: ZarCents): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}R ${whole}.${fraction}`;
}

/** Format integer cents for an editable currency input (e.g. 12550 → "125.50"). */
export function centsToInput(cents: ZarCents | null): string {
  if (cents === null) {
    return "";
  }
  return (cents / 100).toFixed(2);
}

/** Parse user-entered rand amount (e.g. "125.50", "R 125.50") into cents. */
export function parseZarInputToCents(raw: string): ZarCents | null {
  const trimmed = raw.trim().replace(/^R\s*/i, "").replace(/\s/g, "");
  if (trimmed.length === 0) {
    return null;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new RangeError("Amount must be a non-negative rand value with up to two decimals.");
  }
  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const whole = Number(wholePart);
  const fraction = Number((fractionPart + "00").slice(0, 2));
  if (!Number.isInteger(whole) || whole < 0 || !Number.isInteger(fraction)) {
    throw new RangeError("Amount must be a non-negative rand value with up to two decimals.");
  }
  return whole * 100 + fraction;
}

export function computeWorkOrderTimeMaterials(input: {
  visits: FrigoraVisit[];
  partUsages: FrigoraPartUsage[];
  refrigerantEvents: FrigoraRefrigerantEvent[];
}): FrigoraTimeMaterialsSummary {
  const unpriced: FrigoraTimeMaterialsUnpricedItem[] = [];

  const labourLines: FrigoraTimeMaterialsLabourLine[] = [];
  let labourCents = 0;
  for (const visit of input.visits) {
    if (visit.status !== "departed" || !visit.departedAt) {
      continue;
    }
    const durationSeconds = visitDurationSeconds(visit.arrivedAt, visit.departedAt);
    const rate = visit.labourHourlyChargeCents;
    if (rate === null) {
      labourLines.push({
        visitId: visit.id,
        durationSeconds,
        labourHourlyChargeCents: null,
        amountCents: null,
        priced: false,
      });
      unpriced.push({
        kind: "labour",
        evidenceId: visit.id,
        label: `Visit labour (${visit.arrivedAt} → ${visit.departedAt})`,
      });
      continue;
    }
    const amountCents = labourChargeCents(durationSeconds, rate);
    labourLines.push({
      visitId: visit.id,
      durationSeconds,
      labourHourlyChargeCents: rate,
      amountCents,
      priced: true,
    });
    labourCents += amountCents;
  }

  const partLines: FrigoraTimeMaterialsPartLine[] = [];
  let partsCents = 0;
  for (const usage of input.partUsages) {
    const rate = usage.unitChargeCents;
    if (rate === null) {
      partLines.push({
        partUsageId: usage.id,
        quantity: usage.quantity,
        unitChargeCents: null,
        amountCents: null,
        priced: false,
        label: usage.partDescription,
      });
      unpriced.push({
        kind: "part",
        evidenceId: usage.id,
        label: usage.partDescription,
      });
      continue;
    }
    const amountCents = roundChargeCents(usage.quantity, rate);
    partLines.push({
      partUsageId: usage.id,
      quantity: usage.quantity,
      unitChargeCents: rate,
      amountCents,
      priced: true,
      label: usage.partDescription,
    });
    partsCents += amountCents;
  }

  const refrigerantLines: FrigoraTimeMaterialsRefrigerantLine[] = [];
  let refrigerantCents = 0;
  for (const event of input.refrigerantEvents) {
    const chargeable = event.eventKind === "added";
    if (!chargeable) {
      refrigerantLines.push({
        refrigerantEventId: event.id,
        eventKind: event.eventKind,
        quantityKg: event.quantityKg,
        chargePerKgCents: event.chargePerKgCents,
        amountCents: 0,
        priced: true,
        chargeable: false,
        label: `${event.eventKind}: ${event.refrigerantType}`,
      });
      continue;
    }
    const rate = event.chargePerKgCents;
    if (rate === null) {
      refrigerantLines.push({
        refrigerantEventId: event.id,
        eventKind: event.eventKind,
        quantityKg: event.quantityKg,
        chargePerKgCents: null,
        amountCents: 0,
        priced: false,
        chargeable: true,
        label: `${event.eventKind}: ${event.refrigerantType}`,
      });
      unpriced.push({
        kind: "refrigerant",
        evidenceId: event.id,
        label: `Added ${event.quantityKg} kg ${event.refrigerantType}`,
      });
      continue;
    }
    const amountCents = roundChargeCents(event.quantityKg, rate);
    refrigerantLines.push({
      refrigerantEventId: event.id,
      eventKind: event.eventKind,
      quantityKg: event.quantityKg,
      chargePerKgCents: rate,
      amountCents,
      priced: true,
      chargeable: true,
      label: `${event.eventKind}: ${event.refrigerantType}`,
    });
    refrigerantCents += amountCents;
  }

  const knownSubtotalCents = labourCents + partsCents + refrigerantCents;
  const completeness: FrigoraTimeMaterialsCompleteness =
    unpriced.length === 0 ? "complete" : "incomplete";

  return {
    labourLines,
    partLines,
    refrigerantLines,
    labourCents,
    partsCents,
    refrigerantCents,
    knownSubtotalCents,
    completeness,
    totalCents: completeness === "complete" ? knownSubtotalCents : null,
    unpriced,
  };
}
