/**
 * @module monaco-editor/hooks/useMonacoPlugins
 *
 * Hook for dynamically managing plugins at runtime.
 *
 * Usage:
 *   const { register, unregister, togglePlugin, snapshot } = useMonacoPlugins();
 *   register(myPlugin);
 *   togglePlugin("my-plugin");
 */

import { useState, useCallback, useEffect } from "react";
import { pluginRegistry } from "../core/plugin-registry";
import type { MonacoPlugin } from "../types";

export function useMonacoPlugins() {
  const [snapshot, setSnapshot] = useState(pluginRegistry.getSnapshot());

  useEffect(() => {
    const unsub = pluginRegistry.subscribe(() => {
      setSnapshot(pluginRegistry.getSnapshot());
    });
    return unsub;
  }, []);

  const register = useCallback((plugin: MonacoPlugin) => {
    pluginRegistry.register(plugin);
  }, []);

  const registerAll = useCallback((plugins: MonacoPlugin[]) => {
    pluginRegistry.registerAll(plugins);
  }, []);

  const unregister = useCallback((pluginId: string) => {
    pluginRegistry.unregister(pluginId);
  }, []);

  const enable = useCallback((pluginId: string) => {
    pluginRegistry.enable(pluginId);
  }, []);

  const disable = useCallback((pluginId: string) => {
    pluginRegistry.disable(pluginId);
  }, []);

  const togglePlugin = useCallback((pluginId: string) => {
    return pluginRegistry.toggle(pluginId);
  }, []);

  const isEnabled = useCallback((pluginId: string) => {
    return pluginRegistry.isEnabled(pluginId);
  }, []);

  return {
    snapshot,
    register,
    registerAll,
    unregister,
    enable,
    disable,
    togglePlugin,
    isEnabled,
  };
}
