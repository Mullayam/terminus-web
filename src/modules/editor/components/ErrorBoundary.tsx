/**
 * @module editor/components/ErrorBoundary
 * React Error Boundary that catches runtime errors in the editor tree
 * and displays a fallback UI instead of crashing the whole page.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class EditorErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("[FileEditor] Uncaught error:", error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        background: "var(--editor-background, #1e1e1e)",
                        color: "var(--editor-error, #f44)",
                        fontFamily: "monospace",
                        fontSize: 13,
                        padding: 24,
                    }}
                >
                    <div style={{ textAlign: "center", maxWidth: 480 }}>
                        <p style={{ fontWeight: 600, marginBottom: 8 }}>
                            Editor encountered an error
                        </p>
                        <p style={{ color: "var(--editor-muted, #888)", fontSize: 12 }}>
                            {this.state.error?.message ?? "Unknown error"}
                        </p>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            style={{
                                marginTop: 16,
                                padding: "6px 16px",
                                background: "var(--editor-accent, #007acc)",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                                fontSize: 12,
                            }}
                        >
                            Retry
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
