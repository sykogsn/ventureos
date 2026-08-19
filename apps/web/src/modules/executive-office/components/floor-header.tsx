export function FloorHeader({
  dateLabel,
  posture,
  worldLine,
}: {
  dateLabel: string;
  posture: string;
  worldLine: string;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-border pb-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="ids-kicker">Leadership floor</p>
        <p className="ids-caption">{dateLabel}</p>
      </div>
      <div className="max-w-[40rem]">
        <h1 className="ids-display">Executive Office</h1>
        <p className="ids-label mt-2 text-foreground">{posture}</p>
        <p className="ids-body mt-3 text-muted">{worldLine}</p>
      </div>
    </header>
  );
}
