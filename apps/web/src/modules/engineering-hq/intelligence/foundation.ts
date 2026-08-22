import type { EngineeringCatalogue } from "../types";
import type { FoundationIntelligence } from "./types";

export function analyseFoundation(
  catalogue: EngineeringCatalogue,
): FoundationIntelligence {
  const certified = /certified/i.test(catalogue.certification.status);

  return {
    status: catalogue.certification.status || "Unknown",
    version: catalogue.certification.version || "Unknown",
    date: catalogue.certification.date || "Unknown",
    outstanding:
      catalogue.certification.outstanding.length > 0
        ? catalogue.certification.outstanding
        : ["Unknown"],
    gates: catalogue.certification.gates,
    history: [
      {
        version: catalogue.certification.version || "Unknown",
        date: catalogue.certification.date || "Unknown",
        status: catalogue.certification.status || "Unknown",
      },
    ],
    evidence: [
      certified
        ? "FOUNDATION_CERTIFICATION_v1.1.md records FOUNDATION CERTIFIED."
        : "Certification status is not CERTIFIED in the record.",
      `Programme: ${catalogue.certification.programme}.`,
      `${catalogue.certification.outstanding.length} outstanding follow-ups listed in the certification file.`,
      "Certification history currently has one recorded entry. The list is ready for later certifications.",
    ],
  };
}
