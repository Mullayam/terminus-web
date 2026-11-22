import type { ComponentType } from "react";
import { Cog, ScrollText, type LucideIcon } from "lucide-react";
import LogsPanel from "./logs-panel";
import ServicesPanel from "./services-panel";

/**
 * Registry of floating panels. Each entry shows up as a toggle row in the
 * Widget Center and is mounted by the terminal layout while open — adding a
 * panel is one entry here plus its component.
 */
export interface PanelProps {
  sessionId: string;
  onClose: () => void;
}

export interface PanelDef {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Theme color key used for the row accent. */
  accent: "blue" | "cyan" | "green" | "yellow" | "magenta" | "red";
  Component: ComponentType<PanelProps>;
}

export const PANELS: PanelDef[] = [
  { id: "logs", label: "Logs", description: "Follow log files or the systemd journal live", icon: ScrollText, accent: "cyan", Component: LogsPanel },
  { id: "services", label: "Services", description: "systemd units: start/stop/restart, enable, status, live journal", icon: Cog, accent: "yellow", Component: ServicesPanel },
];
