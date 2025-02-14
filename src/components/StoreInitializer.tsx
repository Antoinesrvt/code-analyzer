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

  // Handle hydration
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    const initializeStores = async () => {
      try {
        // Initialize stores by accessing them
        const mainState = mainStore();
        const authState = authStore();
        const analyzedReposState = analyzedReposStore();

        // Verify store states are accessible and have expected structure
        if (!mainState || typeof mainState.loading !== 'boolean' || !('repository' in mainState)) {
          throw new Error('Main store initialization failed: invalid state structure');
        }

        if (!authState || typeof authState.isAuthenticated !== 'boolean' || !('user' in authState)) {
          throw new Error('Auth store initialization failed: invalid state structure');
        }

        if (!analyzedReposState || !Array.isArray(analyzedReposState.analyzedRepos)) {
          throw new Error('Analyzed repos store initialization failed: invalid state structure');
        }

        // Log store initialization for debugging in production
        if (process.env.NODE_ENV === 'production') {
          console.debug('Store initialization:', {
            timestamp: new Date().toISOString(),
            stores: {
              main: {
                initialized: !!mainState,
                hasRepository: !!mainState.repository,
                isLoading: mainState.loading,
                hasError: !!mainState.error,
              },
              auth: {
                initialized: !!authState,
                isAuthenticated: authState.isAuthenticated,
                hasUser: !!authState.user,
                isLoading: authState.isLoading,
              },
              analyzedRepos: {
                initialized: !!analyzedReposState,
                repoCount: analyzedReposState.analyzedRepos.length,
              },
            },
          });
        }

        // Mark as hydrated after successful initialization
        setIsHydrated(true);
        setInitError(null);
      } catch (error) {
        console.error('Store initialization error:', error);
        
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying store initialization (attempt ${retryCount}/${maxRetries})...`);
          setTimeout(initializeStores, retryDelay);
          return;
        }

        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize stores';
        setInitError(new Error(`${errorMessage} (after ${maxRetries} retries)`));
        
        toast.error('Store Initialization Error', {
          description: 'Failed to initialize application state. Please refresh the page.',
          duration: 5000,
        });
      }
    };

    initializeStores();

    return () => {
      setIsHydrated(false);
      setInitError(null);
    };
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