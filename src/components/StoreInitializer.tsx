"use client";

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAnalyzedReposStore } from '@/store/useAnalyzedReposStore';
import { toast } from 'sonner';
import { ClientOnly } from '@/components/ClientOnly';

interface StoreInitializerProps {
  children: React.ReactNode;
}

export function StoreInitializer({ children }: StoreInitializerProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);

  // Use store hooks properly
  const mainStore = useStore();
  const authStore = useAuthStore();
  const analyzedReposStore = useAnalyzedReposStore();

  useEffect(() => {
    try {
      // Initialize stores by accessing them
      const storesInitialized = !!mainStore && !!authStore && !!analyzedReposStore;

      // Log store initialization for debugging in production
      if (process.env.NODE_ENV === 'production') {
        console.debug('Store initialization:', {
          storesInitialized,
          timestamp: new Date().toISOString()
        });

        // Access store states safely
        const mainState = mainStore();
        const authState = authStore();

        // Log initial states
        console.debug('Store states:', {
          main: {
            hasRepository: !!mainState.repository,
            filesCount: mainState.files.length,
            modulesCount: mainState.modules.length,
            isLoading: mainState.loading,
            hasError: !!mainState.error,
          },
          auth: {
            isAuthenticated: authState.isAuthenticated,
            hasUser: !!authState.user,
            isLoading: authState.isLoading,
            hasError: !!authState.error,
          }
        });
      }

      // Mark as hydrated after successful initialization
      setIsHydrated(true);
    } catch (error) {
      console.error('Store initialization error:', error);
      setInitError(error instanceof Error ? error : new Error('Failed to initialize stores'));
      
      toast.error('Store Initialization Error', {
        description: 'Failed to initialize application state. Please refresh the page.',
      });
    }
  }, [mainStore, authStore, analyzedReposStore]);

  // Show loading state
  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 text-lg font-semibold text-foreground">
            Initializing application...
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  // Show error state
  if (initError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Failed to Initialize Application
          </h2>
          <p className="text-muted-foreground mb-4">
            {initError.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md
                     hover:bg-primary/90 transition-colors duration-300"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return children;
}

export default function StoreInitializerWrapper({ children }: StoreInitializerProps) {
  return (
    <ClientOnly>
      <StoreInitializer>{children}</StoreInitializer>
    </ClientOnly>
  );
} 