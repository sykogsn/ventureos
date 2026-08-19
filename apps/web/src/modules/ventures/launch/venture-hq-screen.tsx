import { ventureHasFeature } from "@/core/venture-definition/enforcement";
import type { FoundedCompany } from "./types";
import {
  ArtefactIndex,
  CompanyStoryCard,
  ExecutiveOfficeCard,
  FounderHqCard,
  KnowledgeBaseCard,
  OperatingHealthArtefact,
  SprintOneCard,
  SuggestedDocumentsCard,
  VentureGenomeCard,
} from "./hq/artefact-cards";

export function VentureHqScreen({ company }: { company: FoundedCompany }) {
  const office = ventureHasFeature(company.venture, "executive-office");

  return (
    <section className="flex min-h-full flex-1 flex-col">
      <div className="vos-screen mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="ids-kicker">
            Company HQ · {company.venture.genome.category} · {company.venture.genome.stage}
          </p>
          <h1 className="ids-display">{company.venture.identity.name}</h1>
          <p className="ids-body text-muted">{company.venture.identity.hqSummary}</p>
        </header>

        <ArtefactIndex company={company} />
        <FounderHqCard company={company} />
        <VentureGenomeCard company={company} />

        <div className="grid gap-4 lg:grid-cols-2">
          <OperatingHealthArtefact company={company} />
          {office ? <ExecutiveOfficeCard company={company} /> : null}
        </div>

        <SprintOneCard company={company} />

        <div className="grid gap-4 lg:grid-cols-2">
          <CompanyStoryCard company={company} />
          <KnowledgeBaseCard company={company} />
        </div>

        <SuggestedDocumentsCard company={company} />
      </div>
    </section>
  );
}
