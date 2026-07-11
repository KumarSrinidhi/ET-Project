import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };
  public static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', margin: '20px 0' }}>
          <p style={{ fontWeight: 600, color: '#111827' }}>Component failed to render.</p>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '10px', padding: '4px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px' }}>Reload Tab</button>
        </div>
      );
    }
    return this.props.children;
  }
}
