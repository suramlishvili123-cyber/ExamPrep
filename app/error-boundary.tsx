"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * A single top-level boundary. An unexpected render error must never leave a blank
 * page mid-exam, and the recovery path must not silently discard saved progress.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ESAT Atlas failed to render", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="loading-screen loading-screen-error">
        <div className="brand-mark">EA</div>
        <div>
          <strong>Something went wrong</strong>
          <span>{error.message || "An unexpected error stopped the interface."} Your saved progress is untouched.</span>
        </div>
        <button className="button button-light" onClick={() => window.location.reload()}>Reload ESAT Atlas</button>
      </main>
    );
  }
}
