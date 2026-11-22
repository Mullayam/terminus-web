import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

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

export const PANELS: PanelDef[] = [];
