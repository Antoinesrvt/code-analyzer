import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthStore } from '@/types/auth';

const initialState: AuthStore = {
  isAuthenticated: false,
  user: null,
  isLoading: false,
  error: null,
  setUser: () => {},
  setLoading: () => {},
  setError: () => {},
  logout: () => {},
};

// Create a no-op storage for SSR
const createNoopStorage = () => ({
  getItem: () => Promise.resolve(String(null)),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
});

function createAuthStore(preloadedState: Partial<AuthStore> = {}) {
  return create<AuthStore>()(
    persist(
      (set) => ({
        ...initialState,
        ...preloadedState,
        setUser: (user) =>
          set({
            user,
            isAuthenticated: !!user,
            error: null,
            isLoading: false,
          }),
        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error, isLoading: false }),
        logout: async () => {
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              credentials: 'include',
            });
          } catch (error) {
            console.error('Logout error:', error);
          } finally {
            set({
              isAuthenticated: false,
              user: null,
              error: null,
              isLoading: false,
            });
          }
        },
      }),
      {
        name: 'github-auth-storage',
        storage: createJSONStorage(() => {
          // During SSR, use no-op storage
          if (typeof window === 'undefined') {
            return createNoopStorage();
          }
          return localStorage;
        }),
        skipHydration: true, // Skip hydration during SSR
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    )
  );
}

// Store singleton instance
let store: ReturnType<typeof createAuthStore> | null = null;

export function useAuthStore(initState?: Partial<AuthStore>) {
  // For SSR, always return a new store with initial state
  if (typeof window === 'undefined') {
    return createAuthStore({
      ...initState,
      isLoading: false,
      error: null,
    });
  }

  // For client-side, maintain singleton pattern
  if (!store) {
    store = createAuthStore(initState);
  }

  return store;
}