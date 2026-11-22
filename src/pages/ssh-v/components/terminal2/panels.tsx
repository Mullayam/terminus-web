import type { ComponentType } from "react";
import { Bookmark, CalendarClock, Clapperboard, Cog, Network, Radio, ScrollText, type LucideIcon } from "lucide-react";
import LogsPanel from "./logs-panel";
import ServicesPanel from "./services-panel";
import PortsPanel from "./ports-panel";
import SnippetsPanel from "./snippets-panel";
import BroadcastPanel from "./broadcast-panel";
import RecorderPanel from "./recorder-panel";
import CronPanel from "./cron-panel";

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
  { id: "ports", label: "Ports & processes", description: "Listening ports and top processes, kill, details", icon: Network, accent: "magenta", Component: PortsPanel },
  { id: "snippets", label: "Snippets", description: "Saved commands per host — run, insert, fill in {{placeholders}}", icon: Bookmark, accent: "green", Component: SnippetsPanel },
  { id: "broadcast", label: "Broadcast", description: "Type once, run on several SSH tabs (with safety checks)", icon: Radio, accent: "red", Component: BroadcastPanel },
  { id: "recorder", label: "Recorder", description: "Record the terminal, replay or download as .cast", icon: Clapperboard, accent: "red", Component: RecorderPanel },
  { id: "cron", label: "Cron", description: "View, add, toggle and edit crontab jobs with next-run preview", icon: CalendarClock, accent: "blue", Component: CronPanel },
];
