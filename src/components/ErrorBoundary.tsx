import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log to external service if configured
    if (import.meta.env.VITE_SUPABASE_URL) {
      this.logErrorToService(error, errorInfo);
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  async logErrorToService(error: Error, errorInfo: ErrorInfo) {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      await (supabase as any).from('error_logs').insert({
        error_message: error.message,
        error_stack: error.stack,
        component_stack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-2xl">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Algo salió mal</AlertTitle>
            <AlertDescription className="space-y-4">
              <p>
                Ha ocurrido un error inesperado. Por favor, intenta recargar la página.
              </p>
              
              {this.state.error && (
                <details className="text-xs bg-destructive/10 p-3 rounded">
                  <summary className="cursor-pointer font-medium mb-2">
                    Detalles técnicos
                  </summary>
                  <pre className="whitespace-pre-wrap overflow-auto">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="outline">
                  Reintentar
                </Button>
                <Button onClick={() => window.location.href = '/'}>
                  Volver al inicio
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
