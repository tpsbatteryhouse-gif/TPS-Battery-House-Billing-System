import React from 'react';
import { AlertTriangle, RefreshCw, Home, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * TPS Battery House — Application-Level React Error Boundary
 *
 * Catches any unhandled React render errors, lifecycle errors, or missing hook imports.
 * Displays a helpful, responsive, branded recovery interface instead of a blank white screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught unhandled React error:', error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleResetState = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleClearCacheAndReload = () => {
    try {
      if (typeof localStorage !== 'undefined') {
        // Clear ephemeral draft state that might contain malformed or corrupt structures
        localStorage.removeItem('tps_invoice_draft');
      }
    } catch (e) {
      console.warn('[ErrorBoundary] Failed to clear local cache:', e);
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const errorMessage =
        this.state.error?.message ||
        (typeof this.state.error === 'string' ? this.state.error : 'An unexpected error occurred.');

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-white">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Icon & Branding */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/10">
                <AlertTriangle className="w-8 h-8 stroke-[2.2]" />
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Application Encountered an Error
                </h1>
                <p className="text-xs text-amber-400 font-mono font-medium pt-1">
                  TPS BATTERYS HOUSE — Billing & Store System
                </p>
              </div>
            </div>

            {/* Error Message Card */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-slate-300 text-xs sm:text-sm space-y-2">
              <p className="font-semibold text-white">Something interrupted the screen:</p>
              <p className="text-slate-400 text-xs leading-relaxed font-mono bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 break-words">
                {errorMessage}
              </p>
              <p className="text-[11.5px] text-slate-400 pt-1">
                Your historical invoices and catalog records in Firestore are safe. You can reload or reset your active session below.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700/80 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                title="Clears unfinalized draft from browser storage and reloads clean state"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Clear Local Draft & Reload Clean</span>
              </button>

              {this.props.onReset && (
                <button
                  type="button"
                  onClick={this.handleResetState}
                  className="w-full py-2.5 px-4 bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-medium text-xs rounded-xl border border-slate-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Home className="w-3.5 h-3.5 text-slate-400" />
                  <span>Return to Dashboard</span>
                </button>
              )}
            </div>

            {/* Collapsible Technical Details (for developer diagnostics) */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={this.toggleDetails}
                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-300 py-1 transition-colors"
              >
                <span>Diagnostic Details</span>
                {this.state.showDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {this.state.showDetails && (
                <div className="mt-2.5 p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-48 space-y-1">
                  <div className="text-red-400 font-semibold">{String(this.state.error?.stack || this.state.error)}</div>
                  {this.state.errorInfo?.componentStack && (
                    <div className="text-slate-500 whitespace-pre pt-1 border-t border-slate-900">
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
