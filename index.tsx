
import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Fix: Using Component directly from react and declaring state and props properties explicitly on the class. 
// This resolves the "Property 'state' does not exist" and "Property 'props' does not exist" errors 
// that can occur in certain TypeScript environments where class inheritance from React.Component 
// is not automatically inferred for instance properties.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Fix: Explicitly declaring state property to resolve TypeScript inheritance issues.
  public state: ErrorBoundaryState = {
    hasError: false
  };

  // Fix: Explicitly declaring props property to resolve the "Property 'props' does not exist" error on line 40.
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  // Fix: static getDerivedStateFromError is correctly typed to return ErrorBoundaryState.
  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  // Fix: componentDidCatch using Error and ErrorInfo types from React.
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Modully Error:", error, errorInfo);
  }

  render() {
    // Fix: Accessing hasError and children from this.state and this.props.
    const { hasError } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
            <div className="bg-red-50 text-red-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Algo salió mal</h2>
            <p className="text-gray-500 mb-8">La aplicación encontró un error inesperado al renderizar el diseño.</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all"
            >
              Reiniciar Aplicación
            </button>
          </div>
        </div>
      );
    }
    
    return children || null;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root element not found");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
