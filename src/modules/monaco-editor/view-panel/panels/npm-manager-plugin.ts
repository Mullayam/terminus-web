/**
 * @module monaco-editor/view-panel/panels/npm-manager-plugin
 *
 * Monaco plugin that registers the NPM Manager view panel
 * and provides commands to open it.
 */
import { Package } from "lucide-react";
import React from "react";
import type { MonacoPlugin, PluginContext } from "../../types";
import { registerViewPanel, unregisterViewPanel, openViewPanel } from "../api";
import { NpmManagerPanel } from "./NpmManagerPanel";

export const npmManagerViewPlugin: MonacoPlugin = {
  id: "npm-manager-view",
  name: "NPM Package Manager",
  version: "1.0.0",
  description: "Visual NPM package manager — view, search, add and remove dependencies",
  defaultEnabled: true,
  priority: 10,

  onMount(ctx: PluginContext) {
    // Register view panel descriptor
    registerViewPanel({
      id: "npm-manager",
      title: "📦 NPM Packages",
      icon: React.createElement(Package, { className: "w-3.5 h-3.5" }),
      component: NpmManagerPanel,
      singleton: true,
      priority: 100,
    });

    // Register command to open the panel
    ctx.addAction({
      id: "npm-manager.open",
      label: "NPM: Open Package Manager",
      keybindings: [ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyMod.Shift | ctx.monaco.KeyCode.KeyN],
      run: () => {
        openViewPanel("npm-manager");
      },
    });

    // Auto-open for package.json files
    const filePath = ctx.getFilePath();
    if (filePath?.endsWith("package.json")) {
      // Slight delay so the editor is fully rendered
      setTimeout(() => openViewPanel("npm-manager"), 300);
    }
  },

  onDispose() {
    unregisterViewPanel("npm-manager");
  },
};
