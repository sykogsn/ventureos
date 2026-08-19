import Link from "next/link";

export function FounderWelcome({ founderName }: { founderName: string }) {
  return (
    <section className="flex min-h-full flex-1 flex-col">
      <div className="vos-screen mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
        <p className="ids-kicker">VentureOS · {founderName}</p>
        <h1 className="ids-display mt-5">Welcome to VentureOS</h1>
        <p className="ids-lead mt-10">
          Build.
          <br />
          Operate.
          <br />
          Grow.
        </p>
        <p className="ids-body mt-6 text-muted">
          VentureOS becomes the operating system for every company you create.
        </p>
        <Link href="/ventures/launch" className="vos-btn-primary mt-10 w-fit">
          Found Company
        </Link>
      </div>
    </section>
  );
}
