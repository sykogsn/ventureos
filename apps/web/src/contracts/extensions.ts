export type NavSection = "operate" | "intelligence" | "system";

export type ExtensionIcon =
  | "layout-dashboard"
  | "building-2"
  | "bot"
  | "brain"
  | "settings";

export type NavContribution = {
  id: string;
  label: string;
  href: string;
  section: NavSection;
  icon: ExtensionIcon;
};

export type CommandContribution = {
  id: string;
  title: string;
  group: "navigation" | "ai" | "system";
  keywords?: string[];
  href?: string;
  action?: string;
};

export type ExtensionManifest = {
  id: string;
  name: string;
  version?: string;
  nav?: NavContribution[];
  commands?: CommandContribution[];
  agents?: string[];
  workflows?: string[];
  permissions?: string[];
};
