export function ExecutiveLoading({ message }: { message: string }) {
  return (
    <div
      className="vos-screen flex flex-1 flex-col gap-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="ids-kicker">{message}</p>
      <div className="flex max-w-[42rem] flex-col gap-4">
        <div className="h-8 w-2/3 ids-skeleton" />
        <div className="h-4 w-full ids-skeleton" />
        <div className="h-4 w-5/6 ids-skeleton" />
      </div>
      <div className="vos-panel flex max-w-[42rem] flex-col gap-4 p-6">
        <div className="h-3 w-24 ids-skeleton" />
        <div className="h-5 w-3/4 ids-skeleton" />
        <div className="h-4 w-full ids-skeleton" />
        <div className="h-4 w-4/5 ids-skeleton" />
      </div>
      <span className="sr-only">{message}</span>
    </div>
  );
}
