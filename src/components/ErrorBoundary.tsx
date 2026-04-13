import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends (Component as any) {
  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): any {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Algo salió mal. Por favor, intenta recargar la página.";
      let details = "";

      try {
        // Intentar parsear si es un error de Firestore en formato JSON
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          errorMessage = `Error de base de datos (${parsed.operationType}): ${parsed.error}`;
          details = `Ruta: ${parsed.path || 'N/A'}`;
        }
      } catch {
        // No es JSON, usar el mensaje normal
        if (this.state.error?.message) {
          errorMessage = this.state.error.message;
        }
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-[32px] p-8 shadow-2xl shadow-indigo-100 border border-slate-100 text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto text-rose-500">
              <i className="fa-solid fa-triangle-exclamation text-3xl"></i>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Error Inesperado</h2>
              <p className="text-sm font-medium text-slate-500 leading-relaxed">
                {errorMessage}
              </p>
              {details && (
                <p className="text-[10px] font-mono text-slate-400 bg-slate-50 p-2 rounded-lg break-all">
                  {details}
                </p>
              )}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
