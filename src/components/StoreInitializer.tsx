"use client";

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAnalyzedReposStore } from '@/store/useAnalyzedReposStore';
import { toast } from 'sonner';

interface StoreInitializerProps {
  children: React.ReactNode;
}

export function StoreInitializer({ children }: StoreInitializerProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      // Initialize all stores
      const mainStore = useStore();
      const authStore = useAuthStore();
      const analyzedReposStore = useAnalyzedReposStore();

      // Log store initialization for debugging in production
      console.debug('Store initialization:', {
        mainStore: !!mainStore,
        authStore: !!authStore,
        analyzedReposStore: !!analyzedReposStore,
        timestamp: new Date().toISOString()
      });

      // Subscribe to store changes for debugging
      if (process.env.NODE_ENV === 'production') {
        // Create store instances
        const mainStoreInstance = mainStore();
        const authStoreInstance = authStore();

        // Log initial states
        console.debug('Initial store states:', {
          main: {
            hasRepository: !!mainStoreInstance.repository,
            filesCount: mainStoreInstance.files.length,
            modulesCount: mainStoreInstance.modules.length,
            isLoading: mainStoreInstance.loading,
            hasError: !!mainStoreInstance.error,
          },
          auth: {
            isAuthenticated: authStoreInstance.isAuthenticated,
            hasUser: !!authStoreInstance.user,
            isLoading: authStoreInstance.isLoading,
            hasError: !!authStoreInstance.error,
          }
        });

        // Set up state change listeners
        const unsubscribeMain = mainStore.subscribe?.(
          (state) => {
            console.debug('Main store update:', {
              hasRepository: !!state.repository,
              filesCount: state.files.length,
              modulesCount: state.modules.length,
              isLoading: state.loading,
              hasError: !!state.error,
              timestamp: new Date().toISOString()
            });
          }
        );

        const unsubscribeAuth = authStore.subscribe?.(
          (state) => {
            console.debug('Auth store update:', {
              isAuthenticated: state.isAuthenticated,
              hasUser: !!state.user,
              isLoading: state.isLoading,
              hasError: !!state.error,
              timestamp: new Date().toISOString()
            });
          }
        );

        return () => {
          unsubscribeMain?.();
          unsubscribeAuth?.();
        };
      }
    } catch (error) {
      console.error('Store initialization error:', error);
      setInitError(error instanceof Error ? error : new Error('Failed to initialize stores'));
      
      // Show error toast
      toast.error('Store Initialization Error', {
        description: 'Failed to initialize application state. Please refresh the page.',
      });
    } finally {
      setIsHydrated(true);
    }
  }, []);

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