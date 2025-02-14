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
  const [initializationState, setInitializationState] = useState<{
    main: boolean;
    auth: boolean;
    analyzedRepos: boolean;
  }>({
    main: false,
    auth: false,
    analyzedRepos: false,
  });

  // Use store hooks properly
  const mainStore = useStore();
  const authStore = useAuthStore();
  const analyzedReposStore = useAnalyzedReposStore();

  // Handle hydration
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    let mounted = true;

    const initializeStore = async (
      storeName: 'main' | 'auth' | 'analyzedRepos',
      storeInstance: any,
      validator: () => boolean
    ) => {
      try {
        const state = storeInstance();
        if (!validator()) {
          throw new Error(`${storeName} store validation failed`);
        }
        if (mounted) {
          setInitializationState(prev => ({ ...prev, [storeName]: true }));
        }
        return true;
      } catch (error) {
        console.error(`${storeName} store initialization error:`, error);
        return false;
      }
    };

    const initializeStores = async () => {
      try {
        const results = await Promise.all([
          initializeStore('main', mainStore, () => {
            const state = mainStore();
            return (
              !!state &&
              typeof state.loading === 'boolean' &&
              'repository' in state
            );
          }),
          initializeStore('auth', authStore, () => {
            const state = authStore();
            return (
              !!state &&
              typeof state.isAuthenticated === 'boolean' &&
              'user' in state
            );
          }),
          initializeStore('analyzedRepos', analyzedReposStore, () => {
            const state = analyzedReposStore();
            return !!state && Array.isArray(state.analyzedRepos);
          }),
        ]);

        if (results.every(Boolean)) {
          if (mounted) {
            setIsHydrated(true);
            setInitError(null);
          }
        } else if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying store initialization (attempt ${retryCount}/${maxRetries})...`);
          setTimeout(initializeStores, retryDelay);
        } else {
          throw new Error(`Store initialization failed after ${maxRetries} retries`);
        }

        // Log initialization status in production
        if (process.env.NODE_ENV === 'production') {
          console.debug('Store initialization status:', {
            timestamp: new Date().toISOString(),
            stores: {
              main: initializationState.main,
              auth: initializationState.auth,
              analyzedRepos: initializationState.analyzedRepos,
            },
            retryCount,
          });
        }
      } catch (error) {
        if (mounted) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to initialize stores';
          setInitError(new Error(`${errorMessage} (after ${maxRetries} retries)`));
          toast.error('Store Initialization Error', {
            description: 'Failed to initialize application state. Please refresh the page.',
            duration: 5000,
          });
        }
      }
    };

    initializeStores();

    return () => {
      mounted = false;
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