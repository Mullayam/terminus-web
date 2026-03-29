/**
 * @module monaco-editor/view-panel
 * Barrel export for the view-panel system.
 */
export type { ViewPanelDescriptor, ViewPanelProps } from "./types";
export { useViewPanelStore, type ViewPanelTab } from "./store";
export {
  registerViewPanel,
  unregisterViewPanel,
  openViewPanel,
  closeViewPanel,
  closeAllViewPanels,
  getRegisteredViewPanels,
} from "./api";

// UI components
export { ViewPanelTabBar } from "./ViewPanelTabBar";
export { ViewPanelContent } from "./ViewPanelContent";

// Built-in panels
export { NpmManagerPanel } from "./panels/NpmManagerPanel";
export { npmManagerViewPlugin } from "./panels/npm-manager-plugin";
