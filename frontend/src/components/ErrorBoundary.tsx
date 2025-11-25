import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("✅ ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    height: '100vh',
                    width: '100vw',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#f3f4f6',
                    color: '#1f2937',
                    textAlign: 'center',
                    padding: '20px',
                    position: 'fixed', /* Ensure it covers everything */
                    top: 0,
                    left: 0,
                    zIndex: 9999
                }}>
                    <h1 style={{ fontSize: '3rem', marginBottom: '10px', marginTop: 0 }}>😕 Oops!</h1>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Something went wrong.</h2>
                    <p style={{ maxWidth: '500px', marginBottom: '30px', color: '#6b7280' }}>
                        We encountered an unexpected error. Please try refreshing the page.
                    </p>
                    <button
                        onClick={() => {
                            // Optional: Clear local storage or state if needed
                            window.location.reload();
                        }}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        Refresh Page
                    </button>

                    {/* Always show error details in the UI for debugging if local */}
                    {this.state.error && (
                        <div style={{
                            marginTop: '40px',
                            textAlign: 'left',
                            backgroundColor: '#e5e7eb',
                            padding: '20px',
                            borderRadius: '8px',
                            overflow: 'auto',
                            maxWidth: '800px',
                            maxHeight: '300px',
                            width: '90%',
                            fontFamily: 'monospace',
                            border: '1px solid #d1d5db'
                        }}>
                            <strong>Error Details:</strong><br/>
                            {this.state.error.toString()}
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;