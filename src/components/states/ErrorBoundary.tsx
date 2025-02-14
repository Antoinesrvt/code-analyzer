"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Helper function to format error details
function formatErrorDetails(error: Error, errorInfo: ErrorInfo | null): string {
  const details = [
    `Error: ${error.message}`,
    `Stack: ${error.stack || 'No stack trace available'}`,
    errorInfo ? `Component Stack: ${errorInfo.componentStack}` : '',
    `URL: ${typeof window !== 'undefined' ? window.location.href : 'SSR'}`,
    `User Agent: ${typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR'}`,
    `Timestamp: ${new Date().toISOString()}`
  ].join('\n');

  return details;
}

// Helper to detect store synchronization errors
function isStoreSyncError(error: Error): boolean {
  return (
    error.message.includes('Minified React error #321') ||
    error.message.includes('useSyncExternalStore') ||
    error.message.toLowerCase().includes('hydration')
  );
}

// Wrapper component to provide router to class component
function ErrorBoundaryWrapper(props: Props) {
  const router = useRouter();
  return <ErrorBoundaryClass {...props} router={router} />;
}

class ErrorBoundaryClass extends Component<Props & { router: ReturnType<typeof useRouter> }, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error,
      errorInfo: null
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    const errorDetails = formatErrorDetails(error, errorInfo);
    console.error('Uncaught error:', errorDetails);

    // Update state with error info
    this.setState({
      error,
      errorInfo
    });

    // Show toast notification with error details
    toast.error('An error occurred', {
      description: isStoreSyncError(error)
        ? 'Store synchronization error detected. Try refreshing the page.'
        : 'Something went wrong. Please try again.',
      duration: 5000,
    });

    // If it's a store sync error, automatically refresh after a delay
    if (isStoreSyncError(error)) {
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 2000);
    }

    // Send error to your error tracking service
    try {
      // You can implement your error tracking service here
      // Example: Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
      
      // For now, we'll log to console in a structured way
      console.group('Error Details');
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.error('URL:', typeof window !== 'undefined' ? window.location.href : 'SSR');
      console.error('Timestamp:', new Date().toISOString());
      console.groupEnd();
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }

  private handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleNavigateHome = () => {
    this.props.router.push('/');
  };

  public render() {
    if (this.state.hasError) {
      const isSync = this.state.error && isStoreSyncError(this.state.error);

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {isSync ? 'Store Synchronization Error' : 'Something went wrong'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {isSync
                ? 'We detected an issue with the application state. Please refresh the page.'
                : this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleRefresh}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md 
                         hover:bg-primary/90 transition-colors duration-300"
              >
                Refresh Page
              </button>
              <button
                onClick={this.handleNavigateHome}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md
                         hover:bg-secondary/90 transition-colors duration-300"
              >
                Go to Home
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Error Details
                </summary>
                <pre className="mt-2 p-4 bg-muted rounded-lg overflow-auto text-xs">
                  {formatErrorDetails(this.state.error!, this.state.errorInfo)}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = ErrorBoundaryWrapper;