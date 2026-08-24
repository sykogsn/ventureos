import { Ledger } from "@/core/layout";

const demoRows = [
  ["Surface", "ids-surface-card", "Primary card"],
  ["Elevated", "ids-surface-elevated", "Raised panel"],
  ["Sunken", "ids-surface", "Recessed well"],
] as const;

export function FoundationLedger() {
  return (
    <Ledger>
      {demoRows.map(([role, token, use]) => (
        <li key={role}>
          <span className="ids-kicker">{role}</span>
          <span className="ids-caption">{token}</span>
          <span className="ids-body">{use}</span>
        </li>
      ))}
    </Ledger>
  );
}
