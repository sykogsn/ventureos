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
import { PageFrame } from "@/core";
import { Grid } from "@/core/layout";

export function VentureHqScreen({ company }: { company: FoundedCompany }) {
  const office = ventureHasFeature(company.venture, "executive-office");

  return (
    <PageFrame
      page="Company HQ"
      kicker={`Company HQ · ${company.venture.genome.category} · ${company.venture.genome.stage}`}
      title={company.venture.identity.name}
      description={company.venture.identity.hqSummary}
      ventureId={company.venture.identity.id}
      summary={<ArtefactIndex company={company} />}
    >
      <FounderHqCard company={company} />
      <VentureGenomeCard company={company} />

      <Grid variant="executive">
        <OperatingHealthArtefact company={company} />
        {office ? <ExecutiveOfficeCard company={company} /> : null}
      </Grid>

      <SprintOneCard company={company} />

      <Grid variant="executive">
        <CompanyStoryCard company={company} />
        <KnowledgeBaseCard company={company} />
      </Grid>

      <SuggestedDocumentsCard company={company} />
    </PageFrame>
  );
}
