import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

// A render failure stays inside the calendar; navigation remains usable.
export class CalendarBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Calendar rendering failed', error, info.componentStack);
  }

  render() {
    if (this.state.failed) return (
      <div role="alert" className="p-6 text-center space-y-3">
        <p>No pudimos mostrar el calendario</p>
        <Button variant="outline" onClick={() => this.setState({ failed: false })}>Reintentar</Button>
      </div>
    );
    return this.props.children;
  }
}
