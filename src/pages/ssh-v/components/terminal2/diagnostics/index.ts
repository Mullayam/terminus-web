/**
 * Terminal Diagnostics Module
 *
 * Barrel export — keeps imports clean.
 * All components follow SOLID principles:
 *  - SRP: each file has one concern
 *  - OCP: patterns/endpoint are configurable
 *  - LSP: components accept standard React props
 *  - ISP: callers only import what they need
 *  - DIP: components depend on abstractions (props/hooks), not concrete stores
 */
export { useDiagnostics } from './useDiagnostics';
export type { DiagnosticEntry, DiagnosticCounts } from './useDiagnostics';
export { default as TerminalInfoOverlay } from './terminal-info-overlay';
export { default as DiagnosticsStatus } from './diagnostics-status';
export { default as DiagnosticsChat } from './diagnostics-chat';
