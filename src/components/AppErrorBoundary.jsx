import { Component } from "react";

import { clearSavedBuilderState } from "../utils/appRecovery.js";

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error(error, errorInfo);
    }
  }

  handleReload = () => {
    reloadWindow();
  };

  handleClearSavedBox = () => {
    clearSavedBuilderState(this.props.storageKey);
    reloadWindow();
  };

  render() {
    if (this.state.hasError) {
      return (
        <AppErrorFallback
          platformName={this.props.platformName}
          productName={this.props.productName}
          recoveryCopy={this.props.recoveryCopy}
          onReload={this.handleReload}
          onClearSavedBox={this.handleClearSavedBox}
        />
      );
    }

    return this.props.children;
  }
}

export function AppErrorFallback({
  platformName = "Decant Builder",
  productName = "Decant Builder",
  recoveryCopy = {},
  onReload,
  onClearSavedBox,
}) {
  const title = recoveryCopy.title || "Something unexpected happened.";
  const descriptionTemplate =
    recoveryCopy.description ||
    "{productName} could not finish loading. Your saved box may still be available.";
  const description = descriptionTemplate.replaceAll("{productName}", productName);
  const reloadLabel = recoveryCopy.reloadLabel || "Reload Builder";
  const clearSavedLabel = recoveryCopy.clearSavedLabel || "Clear Saved Box and Reload";

  return (
    <main className="app-error-shell" aria-labelledby="app-error-title">
      <section className="app-error-card">
        <p className="app-error-eyebrow">{platformName}</p>
        <h1 id="app-error-title">{title}</h1>
        <p>{description}</p>

        <div className="app-error-actions">
          <button type="button" onClick={onReload}>
            {reloadLabel}
          </button>
          <button type="button" className="secondary" onClick={onClearSavedBox}>
            {clearSavedLabel}
          </button>
        </div>
      </section>
    </main>
  );
}

function reloadWindow() {
  if (typeof window === "undefined") {
    return;
  }

  window.location.reload();
}

export default AppErrorBoundary;
