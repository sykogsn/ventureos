import Link from "next/link";
import {
  type ComponentPropsWithoutRef,
  forwardRef,
  Fragment,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";

const stackGap = {
  tight: "flex flex-col gap-[var(--ids-foundation-space-2)]",
  compact: "flex flex-col gap-[var(--ids-foundation-space-3)]",
  form: "flex flex-col gap-[var(--ids-foundation-space-6)]",
  section: "flex flex-col gap-[var(--ids-foundation-space-8)]",
} as const;

const clusterJustify = {
  start: "justify-start",
  between: "justify-between",
  end: "justify-end",
} as const;

const measureWidth = {
  sm: "max-w-[var(--ids-foundation-layout-measure-sm)]",
  md: "max-w-[var(--ids-foundation-layout-measure-md)]",
  lg: "max-w-[var(--ids-foundation-layout-measure-lg)]",
  xl: "max-w-[var(--ids-foundation-layout-measure-xl)]",
} as const;

const panelWidth = {
  sm: "w-[var(--ids-foundation-layout-panel-sm)]",
  md: "w-[var(--ids-foundation-layout-panel-md)]",
  lg: "w-[var(--ids-foundation-layout-panel-lg)]",
} as const;

const revealClass = {
  "show-sm": "hidden sm:flex",
  "show-md": "hidden md:inline-flex",
  "show-lg": "hidden lg:inline-flex",
  "hide-sm": "sm:hidden",
  "hide-md": "md:hidden",
  "hide-lg": "lg:hidden",
} as const;

export type LayoutStackGap = keyof typeof stackGap;
export type LayoutClusterJustify = keyof typeof clusterJustify;
export type LayoutMeasureSize = keyof typeof measureWidth;
export type LayoutPanelSize = keyof typeof panelWidth;
export type LayoutGridVariant = "executive" | "analytics" | "pair";
export type LayoutReveal = keyof typeof revealClass;
export type ExecutiveStackGap = LayoutStackGap;

export function Workspace({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full bg-[var(--workspace)] text-foreground">{children}</div>
  );
}

export function SkipLink({
  href = "#main-content",
}: {
  href?: string;
}) {
  return (
    <a
      href={href}
      className="ids-label fixed left-[var(--ids-foundation-space-4)] top-[var(--ids-foundation-space-4)] z-skip -translate-y-[var(--ids-foundation-layout-skip-shift)] rounded-md bg-accent px-[var(--ids-foundation-space-3)] py-[var(--ids-foundation-space-2)] text-accent-foreground shadow-panel focus:translate-y-0 focus:outline-none focus-visible:translate-y-0"
    >
      Skip to main content
    </a>
  );
}

export function NavigationRail({
  open,
  onDismiss,
  children,
}: {
  open: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-dialog ids-overlay lg:hidden"
          aria-label="Close navigation"
          onClick={onDismiss}
        />
      ) : null}
      <aside
        id="primary-navigation"
        className={
          open
            ? "ids-surface-sidebar z-sidebar w-[var(--ids-foundation-layout-sidebar-sm)] shrink-0 flex-col lg:relative lg:flex lg:w-[var(--ids-foundation-layout-sidebar-md)] fixed inset-y-0 left-0 z-dialog flex"
            : "ids-surface-sidebar z-sidebar w-[var(--ids-foundation-layout-sidebar-sm)] shrink-0 flex-col lg:relative lg:flex lg:w-[var(--ids-foundation-layout-sidebar-md)] hidden lg:flex"
        }
      >
        {children}
      </aside>
    </>
  );
}

export function NavigationBrand({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[var(--ids-foundation-layout-toolbar)] items-center border-b border-border px-[var(--ids-foundation-space-4)]">
      {children}
    </div>
  );
}

export function NavigationMenu({ children }: { children: ReactNode }) {
  return (
    <nav
      aria-label="Primary"
      className="flex flex-1 flex-col gap-[var(--ids-foundation-space-6)] overflow-y-auto p-[var(--ids-foundation-space-3)]"
    >
      {children}
    </nav>
  );
}

export function NavigationSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[var(--ids-foundation-space-1)]">
      <p className="ids-kicker px-[var(--ids-foundation-space-2)] pb-[var(--ids-foundation-space-1)]">
        {label}
      </p>
      {children}
    </div>
  );
}

export function NavigationItem({
  href,
  current,
  onNavigate,
  children,
}: {
  href: string;
  current?: boolean;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      className={
        current
          ? "ids-label ids-transition flex items-center gap-[var(--ids-foundation-space-2)] rounded-md px-[var(--ids-foundation-space-2)] py-[var(--ids-foundation-space-2)] bg-surface-selected text-foreground shadow-xs"
          : "ids-label ids-transition flex items-center gap-[var(--ids-foundation-space-2)] rounded-md px-[var(--ids-foundation-space-2)] py-[var(--ids-foundation-space-2)] text-muted hover:bg-surface-hover hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}

export function Stage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>;
}

export function WorkspaceMain({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
    >
      {children}
    </main>
  );
}

export function WorkspaceCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="ids-surface-section vos-screen mx-auto flex w-full max-w-[var(--ids-foundation-layout-measure-xl)] flex-1 flex-col gap-[var(--ids-foundation-space-8)]">
      {children}
    </div>
  );
}

export function Dashboard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[var(--ids-foundation-space-8)]">
      {children}
    </div>
  );
}

export function ReadingRegion({
  size = "lg",
  children,
}: {
  size?: LayoutMeasureSize;
  children: ReactNode;
}) {
  return <div className={`min-w-0 w-full ${measureWidth[size]}`}>{children}</div>;
}

export function Inspector({
  sticky = false,
  children,
}: {
  sticky?: boolean;
  children: ReactNode;
}) {
  return (
    <aside
      className={
        sticky
          ? "w-full shrink-0 lg:w-[var(--ids-foundation-layout-sidebar-lg)] lg:sticky lg:top-[var(--ids-foundation-space-6)]"
          : "w-full shrink-0 lg:w-[var(--ids-foundation-layout-sidebar-lg)]"
      }
    >
      {children}
    </aside>
  );
}

export function Panel({
  size = "md",
  children,
}: {
  size?: LayoutPanelSize;
  children: ReactNode;
}) {
  return <div className={`max-w-full ${panelWidth[size]}`}>{children}</div>;
}

export function Anchor({ children }: { children: ReactNode }) {
  return <div className="relative">{children}</div>;
}

export const OverlayPanel = forwardRef<
  HTMLDivElement,
  {
    align?: "start" | "end";
    size?: LayoutPanelSize;
    children: ReactNode;
  }
>(function OverlayPanel({ align = "start", size = "sm", children }, ref) {
  return (
    <div
      ref={ref}
      role="dialog"
      className={
        align === "end"
          ? `absolute right-0 top-[calc(100%+var(--ids-foundation-space-2))] z-popover ${panelWidth[size]} ids-surface-modal p-[var(--ids-foundation-space-2)]`
          : `absolute left-0 top-[calc(100%+var(--ids-foundation-space-2))] z-popover ${panelWidth[size]} ids-surface-modal p-[var(--ids-foundation-space-2)]`
      }
    >
      {children}
    </div>
  );
});

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <header
      className="ids-surface-toolbar z-topbar flex h-[var(--ids-foundation-layout-toolbar)] shrink-0 items-center gap-[var(--ids-foundation-space-2)] px-[var(--ids-foundation-space-3)] sm:gap-[var(--ids-foundation-space-3)] sm:px-[var(--ids-foundation-space-4)]"
      role="banner"
    >
      {children}
    </header>
  );
}

export function StatusRegion({ children }: { children: ReactNode }) {
  return (
    <footer className="mt-auto border-t border-border pt-[var(--ids-foundation-space-6)]">
      {children}
    </footer>
  );
}

export const CommandField = forwardRef<
  HTMLInputElement,
  Omit<ComponentPropsWithoutRef<"input">, "className">
>(function CommandField(props, ref) {
  return (
    <input
      ref={ref}
      className="ids-label h-[var(--ids-foundation-space-12)] w-full border-b border-border bg-transparent px-[var(--ids-foundation-space-4)] outline-none placeholder:text-muted focus-visible:ring-0"
      {...props}
    />
  );
});

export function CommandList({ children }: { children: ReactNode }) {
  return (
    <div className="max-h-[var(--ids-foundation-layout-panel-lg)] overflow-y-auto p-[var(--ids-foundation-space-2)]">
      {children}
    </div>
  );
}

export function CommandEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="px-[var(--ids-foundation-space-2)] py-[var(--ids-foundation-space-6)]">
      {children}
    </div>
  );
}

export function CommandGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-[var(--ids-foundation-space-2)]">
      <p className="ids-kicker px-[var(--ids-foundation-space-2)] py-[var(--ids-foundation-space-2)]">
        {label}
      </p>
      {children}
    </div>
  );
}

export function CommandRegion({
  label,
  onDismiss,
  onKeyDown,
  children,
}: {
  label: string;
  onDismiss: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-dialog flex items-start justify-center ids-overlay px-[var(--ids-foundation-space-4)] pt-[var(--ids-foundation-layout-command-offset)]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close command palette"
        onClick={onDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative z-10 w-full max-w-[var(--ids-foundation-layout-measure-md)] overflow-hidden ids-surface-modal"
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}

export function Grid({
  variant,
  children,
}: {
  variant: LayoutGridVariant;
  children: ReactNode;
}) {
  return (
    <div
      className={
        variant === "executive"
          ? "grid w-full gap-[var(--ids-foundation-space-4)] lg:grid-cols-[var(--ids-foundation-layout-grid-executive)]"
          : variant === "pair"
            ? "grid w-full gap-[var(--ids-foundation-space-2)] sm:grid-cols-[var(--ids-foundation-layout-grid-executive)]"
            : "grid w-full gap-[var(--ids-foundation-space-4)] md:grid-cols-[var(--ids-foundation-layout-grid-executive)] xl:grid-cols-[var(--ids-foundation-layout-grid-analytics)]"
      }
    >
      {children}
    </div>
  );
}

export function Flow({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[var(--ids-foundation-space-8)]">
      {children}
    </div>
  );
}

export function Stack({
  gap = "section",
  children,
}: {
  gap?: LayoutStackGap;
  children: ReactNode;
}) {
  return <div className={stackGap[gap]}>{children}</div>;
}

export function Cluster({
  justify = "between",
  wrap = true,
  children,
}: {
  justify?: LayoutClusterJustify;
  wrap?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={
        wrap
          ? `flex flex-wrap items-center ${clusterJustify[justify]} gap-[var(--ids-foundation-space-3)]`
          : `flex items-center ${clusterJustify[justify]} gap-[var(--ids-foundation-space-2)]`
      }
    >
      {children}
    </div>
  );
}

export function SplitView({ children }: { children: ReactNode }) {
  return <Fragment>{children}</Fragment>;
}

export function Desk({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full items-start gap-[var(--ids-foundation-space-8)] lg:grid-cols-[minmax(0,1fr)_var(--ids-foundation-layout-sidebar-lg)]">
      {children}
    </div>
  );
}

export function Stretch({ children }: { children: ReactNode }) {
  return <div className="h-full">{children}</div>;
}

export function ChoiceFace({
  selected = false,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<"button">, "className"> & {
  selected?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={
        selected
          ? "ids-surface-card ids-surface-selected ids-transition flex flex-col gap-[var(--ids-foundation-space-1)] p-[var(--ids-foundation-space-3)] text-left"
          : "ids-surface-card ids-transition flex flex-col gap-[var(--ids-foundation-space-1)] p-[var(--ids-foundation-space-3)] text-left hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background"
      }
      {...props}
    >
      {children}
    </button>
  );
}

export function Reveal({
  on,
  children,
}: {
  on: LayoutReveal;
  children: ReactNode;
}) {
  return <div className={revealClass[on]}>{children}</div>;
}

export function Grow({ children }: { children: ReactNode }) {
  return <div className="ml-[var(--ids-foundation-space-1)] hidden min-w-0 flex-1 sm:flex">{children}</div>;
}

export function Trailing({ children }: { children: ReactNode }) {
  return (
    <div className="ml-auto flex items-center gap-[var(--ids-foundation-space-1)]">
      {children}
    </div>
  );
}

export function SwitcherBound({
  size,
  children,
}: {
  size: "sm" | "md";
  children: ReactNode;
}) {
  return (
    <div
      className={
        size === "sm"
          ? "max-w-[var(--ids-foundation-layout-switcher-sm)]"
          : "max-w-[var(--ids-foundation-layout-switcher-md)]"
      }
    >
      {children}
    </div>
  );
}

export function PageRoot({
  ventureId,
  children,
}: {
  ventureId?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-venture-id={ventureId}
      className="flex min-h-full flex-1 flex-col"
    >
      {children}
    </section>
  );
}

export function BrandRail({ children }: { children: ReactNode }) {
  return (
    <aside className="ids-surface-sidebar relative hidden min-h-full w-[var(--ids-foundation-layout-rail)] shrink-0 flex-col justify-between px-[var(--ids-foundation-space-8)] py-[var(--ids-foundation-space-10)] lg:flex xl:w-[var(--ids-foundation-layout-rail-wide)]">
      {children}
    </aside>
  );
}

export function Banner({ children }: { children: ReactNode }) {
  return (
    <div className="ids-surface-toolbar px-[var(--ids-foundation-space-4)] py-[var(--ids-foundation-space-5)] lg:hidden">
      {children}
    </div>
  );
}

export function Main({
  align = "start",
  children,
}: {
  align?: "start" | "center";
  children: ReactNode;
}) {
  return (
    <main
      className={
        align === "center"
          ? "flex flex-1 flex-col justify-center"
          : "flex flex-1 flex-col"
      }
    >
      {children}
    </main>
  );
}

export function Document({
  kicker,
  title,
  description,
  lede,
  meta,
}: {
  kicker?: string;
  title: string;
  description?: ReactNode;
  lede?: string;
  meta?: string;
}) {
  return (
    <Stack gap="tight">
      {kicker || meta ? (
        <Cluster justify="between" wrap>
          {kicker ? <p className="ids-kicker">{kicker}</p> : <span />}
          {meta ? <p className="ids-caption">{meta}</p> : null}
        </Cluster>
      ) : null}
      <h1 className="ids-heading">{title}</h1>
      {lede ? <p className="ids-label text-foreground">{lede}</p> : null}
      {description ? <p className="ids-body text-muted">{description}</p> : null}
    </Stack>
  );
}

export function Form({
  gap = "form",
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<"form">, "className"> & {
  gap?: LayoutStackGap;
}) {
  return (
    <form className={stackGap[gap]} {...props}>
      {children}
    </form>
  );
}

export function Field({ children }: { children: ReactNode }) {
  return <label className="ids-label flex flex-col gap-[var(--ids-foundation-space-2)]">{children}</label>;
}

export function Inline({ children }: { children: ReactNode }) {
  return (
    <label className="ids-label flex items-center gap-[var(--ids-foundation-space-2)]">
      {children}
    </label>
  );
}

export function Fill({ children }: { children: ReactNode }) {
  return <div className="w-full [&>*]:w-full">{children}</div>;
}

export function Fit({ children }: { children: ReactNode }) {
  return <div className="w-fit">{children}</div>;
}

export function Rule({ children }: { children: ReactNode }) {
  return <p className="ids-caption text-center">{children}</p>;
}

export function HeaderRule({ children }: { children: ReactNode }) {
  return (
    <header className="flex flex-col gap-[var(--ids-foundation-space-5)] border-b border-border bg-[var(--header)] pb-[var(--ids-foundation-space-8)]">
      {children}
    </header>
  );
}

export function Breadcrumb({ children }: { children: ReactNode }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-[var(--ids-foundation-space-2)]">{children}</ol>
    </nav>
  );
}

export function Inset({ children }: { children: ReactNode }) {
  return (
    <div className="px-[var(--ids-foundation-space-2)] py-[var(--ids-foundation-space-2)]">
      {children}
    </div>
  );
}

export function Hairline({
  space = "tight",
  children,
}: {
  space?: "tight" | "compact" | "section";
  children: ReactNode;
}) {
  const pad = {
    tight: "pt-[var(--ids-foundation-space-2)]",
    compact: "pt-[var(--ids-foundation-space-4)]",
    section: "pt-[var(--ids-foundation-space-5)]",
  }[space];

  return <div className={`border-t border-border ${pad}`}>{children}</div>;
}

export function ControlButton({
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<"button">, "className"> & {
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="ids-transition inline-flex h-[var(--ids-foundation-control-height-sm)] w-[var(--ids-foundation-control-height-sm)] items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground"
      {...props}
    >
      {children}
    </button>
  );
}

export function ControlFace() {
  return (
    <span
      className="inline-flex h-[var(--ids-foundation-control-height-sm)] w-[var(--ids-foundation-control-height-sm)]"
      aria-hidden
    />
  );
}

export function Pulse({
  height = "4",
  width = "full",
}: {
  height?: "3" | "4" | "5" | "8";
  width?: "full" | "wide" | "majority" | "half" | "third";
}) {
  const heights = {
    "3": "h-[var(--ids-foundation-space-3)]",
    "4": "h-[var(--ids-foundation-space-4)]",
    "5": "h-[var(--ids-foundation-space-5)]",
    "8": "h-[var(--ids-foundation-space-8)]",
  } as const;
  const widths = {
    full: "w-full",
    wide: "w-5/6",
    majority: "w-3/4",
    half: "w-1/2",
    third: "w-1/3",
  } as const;

  return <div className={`${heights[height]} ${widths[width]} ids-skeleton`} />;
}

export function SurfaceBody({ children }: { children: ReactNode }) {
  return <div className="p-[var(--ids-foundation-space-6)]">{children}</div>;
}

export function StackList({
  as: Tag = "ul",
  children,
}: {
  as?: "ul" | "ol" | "div";
  children: ReactNode;
}) {
  return (
    <Tag className="flex flex-col [&>*]:border-t [&>*]:border-border [&>*]:py-[var(--ids-foundation-space-5)] [&>*:first-child]:border-t-0 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
      {children}
    </Tag>
  );
}

export function RankedList({ children }: { children: ReactNode }) {
  return (
    <ol className="flex flex-col gap-[var(--ids-foundation-space-3)]">{children}</ol>
  );
}

export function MetricPair({ children }: { children: ReactNode }) {
  return (
    <dl className="grid w-full gap-[var(--ids-foundation-space-4)] border-t border-border pt-[var(--ids-foundation-space-5)] sm:grid-cols-[var(--ids-foundation-layout-grid-executive)]">
      {children}
    </dl>
  );
}

export function Ledger({ children }: { children: ReactNode }) {
  return (
    <ul className="flex flex-col [&>li]:grid [&>li]:gap-[var(--ids-foundation-space-1)] [&>li]:border-t [&>li]:border-border [&>li]:py-[var(--ids-foundation-space-4)] [&>li]:first:border-t-0 [&>li]:first:pt-0 sm:[&>li]:grid-cols-[var(--ids-foundation-layout-grid-ledger)] sm:[&>li]:items-baseline sm:[&>li]:gap-[var(--ids-foundation-space-4)]">
      {children}
    </ul>
  );
}

export function InsetSurface({ children }: { children: ReactNode }) {
  return (
    <div className="ids-surface-elevated p-[var(--ids-foundation-space-3)]">{children}</div>
  );
}

export function SettingsBand({ children }: { children: ReactNode }) {
  return (
    <section className="flex max-w-[var(--ids-foundation-layout-measure-md)] flex-col gap-[var(--ids-foundation-space-2)] border-b border-border pb-[var(--ids-foundation-space-6)] last:border-b-0 last:pb-0">
      {children}
    </section>
  );
}

export function WizardBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[var(--ids-foundation-layout-sidebar-lg)] max-w-[var(--ids-foundation-layout-measure-lg)] flex-col gap-[var(--ids-foundation-space-4)]">
      {children}
    </div>
  );
}

export function SurfaceTabs({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <nav
      aria-label={label}
      className="ids-surface-toolbar flex gap-[var(--ids-foundation-space-1)] overflow-x-auto px-[var(--ids-foundation-space-3)] sm:px-[var(--ids-foundation-space-4)]"
    >
      {children}
    </nav>
  );
}

export function SurfaceTabFace({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={
        active
          ? "ids-label ids-transition shrink-0 border-b-2 border-accent px-[var(--ids-foundation-space-3)] py-[var(--ids-foundation-space-3)] text-foreground"
          : "ids-label ids-transition shrink-0 px-[var(--ids-foundation-space-3)] py-[var(--ids-foundation-space-3)] text-muted hover:text-foreground"
      }
    >
      {children}
    </span>
  );
}

export function Sequence({ children }: { children: ReactNode }) {
  return (
    <ol className="flex items-start gap-[var(--ids-foundation-space-1)] overflow-x-auto pb-[var(--ids-foundation-space-1)]">
      {children}
    </ol>
  );
}

export function SequenceStep({ children }: { children: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-1 items-center gap-[var(--ids-foundation-space-1)]">
      {children}
    </li>
  );
}

export function SequenceMark({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-[var(--ids-foundation-space-2)]">
      {children}
    </div>
  );
}

export function SequenceMarkBadge({
  state,
  children,
}: {
  state: "current" | "complete" | "skipped" | "idle";
  children: ReactNode;
}) {
  const tone = {
    current: "bg-accent text-accent-foreground",
    complete: "bg-accent/20 text-foreground",
    skipped: "bg-surface-hover text-muted line-through",
    idle: "bg-surface-hover text-muted",
  }[state];

  return (
    <span
      className={`ids-kicker ids-transition flex h-[var(--ids-foundation-control-height-sm)] w-[var(--ids-foundation-control-height-sm)] items-center justify-center rounded-full ${tone}`}
    >
      {children}
    </span>
  );
}

export function SequenceRail({ complete }: { complete: boolean }) {
  return (
    <span
      className={
        complete
          ? "mb-[var(--ids-foundation-space-5)] hidden h-px flex-1 bg-foreground/40 sm:block"
          : "mb-[var(--ids-foundation-space-5)] hidden h-px flex-1 bg-border sm:block"
      }
      aria-hidden
    />
  );
}

export function SequenceCaption({
  current,
  children,
}: {
  current: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={
        current
          ? "ids-caption hidden truncate sm:block ids-label text-foreground"
          : "ids-caption hidden truncate sm:block text-muted"
      }
    >
      {children}
    </span>
  );
}

export function ModalStage({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-dialog flex items-center justify-center ids-overlay px-[var(--ids-foundation-space-4)]">
      {children}
    </div>
  );
}

export function ModalMeasure({ children }: { children: ReactNode }) {
  return (
    <div className="ids-surface-modal w-full max-w-[var(--ids-foundation-layout-measure-sm)]">
      {children}
    </div>
  );
}

export function DefinitionRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-[var(--ids-foundation-space-4)] border-b border-border py-[var(--ids-foundation-space-3)] last:border-b-0">
      {children}
    </div>
  );
}

export function TaskRow({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-[var(--ids-foundation-space-3)] border-b border-border py-[var(--ids-foundation-space-3)] last:border-b-0">
      {children}
    </li>
  );
}

export const ExecutiveFrame = Workspace;
export const ExecutiveSplit = SplitView;
export const ExecutiveRail = BrandRail;
export const ExecutiveStage = Stage;
export const ExecutiveBanner = Banner;
export function ExecutiveMain({ children }: { children: ReactNode }) {
  return <Main align="center">{children}</Main>;
}
export function ExecutiveMeasure({ children }: { children: ReactNode }) {
  return (
    <div className="vos-screen mx-auto w-full max-w-[var(--ids-foundation-layout-measure-sm)]">
      {children}
    </div>
  );
}
export const ExecutiveStack = Stack;
export const ExecutiveForm = Form;
export const ExecutiveField = Field;
export const ExecutiveInline = Inline;
export const ExecutiveCluster = Cluster;
export const ExecutiveFill = Fill;
export const ExecutiveFit = Fit;
export function ExecutiveDocument({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: ReactNode;
}) {
  return (
    <Stack gap="tight">
      <p className="ids-kicker">{kicker}</p>
      <h1 className="ids-heading">{title}</h1>
      <p className="ids-body text-muted">{description}</p>
    </Stack>
  );
}
export const ExecutiveRule = Rule;
