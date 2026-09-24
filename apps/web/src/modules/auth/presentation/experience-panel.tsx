import { AUTH_EXPERIENCE, AUTH_MARK } from "./copy";

export type AuthExperienceCopy = {
  eyebrow: string;
  title: string;
  cadence: readonly string[];
  message: string;
};

function ExperienceMotif() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.16] dark:opacity-[0.11]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border-subtle) 1px, transparent 1px), linear-gradient(to bottom, var(--border-subtle) 1px, transparent 1px)",
          backgroundSize: "88px 88px",
          maskImage:
            "radial-gradient(70% 58% at 10% 6%, black 0%, transparent 54%)",
          WebkitMaskImage:
            "radial-gradient(70% 58% at 10% 6%, black 0%, transparent 54%)",
        }}
      />
      <span
        className="absolute inset-y-0 left-12 w-px bg-border-subtle opacity-20 xl:left-16"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 6%, black 16%, black 30%, transparent 48%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 6%, black 16%, black 30%, transparent 48%)",
        }}
      />
      <span className="absolute top-1/2 left-12 size-[3px] -translate-x-[1px] -translate-y-[1px] rounded-full bg-venture-accent opacity-40 xl:left-16" />
      <div
        className="absolute -bottom-40 -left-24 size-[38rem] rounded-full opacity-[0.10] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 64%)" }}
      />
    </div>
  );
}

export function AuthExperiencePanel({
  mark = AUTH_MARK,
  experience = AUTH_EXPERIENCE,
  ariaLabel = "About VentureOS",
}: {
  mark?: string;
  experience?: AuthExperienceCopy;
  ariaLabel?: string;
}) {
  const hasBrand = Boolean(mark || experience.eyebrow);
  const hasCopy = Boolean(
    experience.title || experience.message || experience.cadence.length > 0,
  );

  return (
    <section
      aria-label={ariaLabel}
      className="relative isolate hidden overflow-hidden lg:flex lg:flex-col lg:px-12 lg:py-12 xl:px-16"
    >
      <ExperienceMotif />

      {hasBrand ? (
        <div className="relative flex items-center gap-2.5">
          {mark ? (
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-text-primary text-[0.75rem] font-medium text-text-inverse">
              {mark}
            </span>
          ) : null}
          {experience.eyebrow ? (
            <span className="text-[0.6875rem] font-medium tracking-[0.16em] text-text-secondary uppercase">
              {experience.eyebrow}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="relative my-auto flex max-w-[34rem] flex-col justify-center py-12">
        {hasCopy ? (
          <div className="space-y-8">
            <div className="space-y-5">
              {experience.title ? (
                <h2 className="text-[clamp(2rem,2.8vw,2.75rem)] leading-[1.05] font-medium tracking-[-0.035em] text-text-primary">
                  {experience.title}
                </h2>
              ) : null}

              {experience.cadence.length > 0 ? (
                <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[1rem] font-medium tracking-[-0.012em] text-text-secondary">
                  {experience.cadence.map((word, index) => (
                    <span key={word} className="flex items-baseline gap-4">
                      {index > 0 ? (
                        <span aria-hidden="true" className="h-3 w-px bg-border-strong" />
                      ) : null}
                      {word}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>

            <span className="block h-px w-20 bg-border-strong" aria-hidden="true" />

            {experience.message ? (
              <p className="max-w-[28rem] text-[0.9375rem] leading-[1.7] font-medium tracking-[-0.01em] text-text-secondary">
                {experience.message}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function AuthExperienceBand({
  experience = AUTH_EXPERIENCE,
}: {
  experience?: AuthExperienceCopy;
}) {
  if (!experience.title && !experience.message && experience.cadence.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 lg:hidden">
      {experience.title ? (
        <p className="text-[1.0625rem] font-medium tracking-[-0.02em] text-text-primary">
          {experience.title}
        </p>
      ) : null}
      {experience.cadence.length > 0 || experience.message ? (
        <p className="text-[0.8125rem] leading-relaxed text-text-muted">
          {[...experience.cadence, experience.message].filter(Boolean).join(" ")}
        </p>
      ) : null}
    </div>
  );
}
