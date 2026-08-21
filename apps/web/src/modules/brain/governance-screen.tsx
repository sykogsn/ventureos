import Link from "next/link";
import { governanceInstruments } from "@/platform/brain";
import { BrainFrame } from "./components/brain-frame";
import { StatusMark } from "./components/status-mark";

export function BrainGovernanceScreen() {
  return (
    <BrainFrame
      page="Governance"
      title="Governance"
      description="The instruments the desk is bound to. Open an object to read the record."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {governanceInstruments.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="ids-surface-card ids-transition flex flex-col gap-4 p-6 hover:bg-surface-hover"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="ids-label text-foreground">{item.title}</h2>
              <StatusMark>{item.status}</StatusMark>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="ids-kicker">Version</dt>
                <dd className="ids-body mt-1 text-muted">{item.version}</dd>
              </div>
              <div>
                <dt className="ids-kicker">Owner</dt>
                <dd className="ids-body mt-1 text-muted">{item.owner}</dd>
              </div>
              <div className="col-span-2">
                <dt className="ids-kicker">Last review</dt>
                <dd className="ids-body mt-1 text-muted">{item.lastReview}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
    </BrainFrame>
  );
}
