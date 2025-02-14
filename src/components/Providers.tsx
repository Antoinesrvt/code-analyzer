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
            retry: 2,
            refetchOnWindowFocus: false,
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