"use client";

import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui";

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <Button onClick={() => this.setState({ hasError: false })}>Retry</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
