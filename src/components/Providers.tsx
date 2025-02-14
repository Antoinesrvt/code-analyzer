'use client';

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/auth/AuthContext";
import { RepositoryProvider } from "@/contexts/repository/RepositoryContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "sonner";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: (failureCount, error) => {
              // Don't retry on 400 errors
              if (error instanceof Error && error.message.includes('400')) return false;
              // Don't retry on 401/403 errors
              if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) return false;
              // Retry other errors up to 2 times
              return failureCount < 2;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex), 30000),
            refetchOnWindowFocus: false,
            refetchOnMount: "always",
            refetchOnReconnect: "always",
            // Add timeout to requests
            queryFn: async ({ queryKey, signal }) => {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

              try {
                const response = await fetch(queryKey[0] as string, {
                  signal: controller.signal,
                  credentials: 'include',
                  headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                  }
                });

                clearTimeout(timeout);

                if (!response.ok) {
                  const error = await response.json();
                  throw new Error(error.error?.message || error.error_description || error.error || 'Request failed');
                }

                return response.json();
              } catch (error) {
                clearTimeout(timeout);
                throw error instanceof Error ? error : new Error(JSON.stringify(error));
              }
            }
          },
          mutations: {
            retry: (failureCount, error) => {
              if (error instanceof Error && error.message.includes('400')) return false;
              return failureCount < 1;
            },
            retryDelay: 1000,
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RepositoryProvider>
            {children}
            <Toaster
              position="bottom-center"
              expand={true}
              richColors
              closeButton
              duration={5000}
              visibleToasts={3}
              toastOptions={{
                style: { background: "white" },
                className: "border border-gray-200",
                descriptionClassName: "text-gray-500",
              }}
            />
          </RepositoryProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
} 