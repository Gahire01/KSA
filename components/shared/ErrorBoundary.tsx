"use client";

import * as React from "react";
import { AlertOctagonIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render errors in a subtree and offers a retry. */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Mock-only app: log to the console so the demo never hits a dead screen.
    console.error("[ksa]", this.props.label ?? "component error", error, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red/40 bg-red-bg px-6 py-10 text-center"
      >
        <AlertOctagonIcon className="size-6 text-red" aria-hidden />
        <div className="space-y-1">
          <p className="font-display text-sm font-semibold text-ink">
            {this.props.label ?? "This section failed to load"}
          </p>
          <p className="max-w-md text-sm text-ink-2">{error.message}</p>
        </div>
        <Button size="sm" variant="outline" onClick={this.reset}>
          <RefreshCwIcon className="size-3.5" />
          Try again
        </Button>
      </div>
    );
  }
}
