'use client';

import { createContext, useContext } from 'react';
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { User } from '@/types/auth';
import type { IUser } from '@/models/User';
import React from 'react';

interface AuthState {
  isAuthenticated: boolean;
  githubUser: User | null;
  dbUser: IUser | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

interface AuthData {
  isAuthenticated: boolean;
  githubUser: User | null;
  dbUser: IUser | null;
  timestamp: number;
}

// Constants
const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds
const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds
const STALE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

// API functions
async function checkAuthStatus() {
  const response = await fetch('/api/auth/status', {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error_description || error.error || 'Failed to check authentication status');
  }
  
  const data = await response.json();
  return {
    isAuthenticated: data.data?.isAuthenticated ?? false,
    githubUser: data.data?.user || null,
    dbUser: data.data?.dbUser || null,
    timestamp: Date.now(),
  };
}

async function initiateLogin() {
  const response = await fetch('/api/auth/github', {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error_description || error.error || 'Failed to initialize login');
  }

  const data = await response.json();
  if (!data.data?.url) {
    throw new Error('No authorization URL returned from server');
  }

  return data.data;
}

async function logoutUser() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error_description || error.error || 'Failed to logout');
  }

  const data = await response.json();
  return data.data;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isClient, setIsClient] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Set isClient to true on mount
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Get initial data from localStorage only on client-side
  const getInitialData = React.useCallback(() => {
    if (!isClient) return undefined;
    
    try {
      const cached = localStorage.getItem('auth');
      if (cached) {
        const parsed = JSON.parse(cached);
        const age = Date.now() - (parsed.timestamp || 0);
        if (age > SESSION_EXPIRY) {
          localStorage.removeItem('auth');
          return undefined;
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to read auth cache:', e);
    }
    return undefined;
  }, [isClient]);

  // Initialize query client with cached data
  React.useEffect(() => {
    if (isClient && !isInitialized) {
      const cachedData = getInitialData();
      if (cachedData) {
        queryClient.setQueryData(['auth'], cachedData);
      }
      setIsInitialized(true);
    }
  }, [isClient, isInitialized, queryClient, getInitialData]);

  // Auth status query with session expiry check
  const queryOptions: UseQueryOptions<AuthData, Error> = {
    queryKey: ['auth'],
    queryFn: checkAuthStatus,
    retry: (failureCount, error) => {
      if (error.message.includes('401')) return false;
      if (error.message.includes('403')) return false;
      return failureCount < 2;
    },
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.isAuthenticated) return false;
      const age = Date.now() - (data.timestamp || 0);
      return age > REFRESH_INTERVAL ? REFRESH_INTERVAL : false;
    },
    refetchOnMount: true,
    enabled: isClient && isInitialized,
    initialData: getInitialData,
  };

  const { data: authData, isLoading, error: queryError } = useQuery<AuthData, Error>(queryOptions);

  // Cache auth data in localStorage only on client-side
  React.useEffect(() => {
    if (isClient && authData) {
      try {
        localStorage.setItem('auth', JSON.stringify({ ...authData, timestamp: Date.now() }));
      } catch (e) {
        console.error('Failed to cache auth data:', e);
      }
    }
  }, [authData, isClient]);

  // Clear cache on logout
  const clearAuthCache = React.useCallback(() => {
    if (isClient) {
      try {
        localStorage.removeItem('auth');
      } catch (e) {
        console.error('Failed to clear auth cache:', e);
      }
    }
    queryClient.setQueryData(['auth'], {
      isAuthenticated: false,
      githubUser: null,
      dbUser: null,
      timestamp: Date.now(),
    });
    queryClient.invalidateQueries({ queryKey: ['auth'] });
  }, [isClient, queryClient]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: initiateLogin,
    onMutate: () => {
      setError(null);
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No authorization URL returned from server');
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize login';
      setError(errorMessage);
      toast.error('Login failed', { 
        description: errorMessage,
        duration: 5000
      });
    },
  });

  // Logout mutation with cache clearing
  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onMutate: () => {
      setError(null);
    },
    onSuccess: () => {
      clearAuthCache();
      toast.success('Successfully logged out');
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to logout';
      setError(errorMessage);
      toast.error('Logout failed', { description: errorMessage });
    },
  });

  const login = async () => {
    await loginMutation.mutateAsync();
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const refreshUser = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['auth'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh user');
    } finally {
      setIsRefreshing(false);
    }
  };

  const clearError = () => setError(null);

  const value: AuthContextType = {
    isAuthenticated: authData?.isAuthenticated ?? false,
    githubUser: authData?.githubUser ?? null,
    dbUser: authData?.dbUser ?? null,
    isLoading: !isClient || !isInitialized || isLoading,
    isRefreshing,
    error: error || (queryError instanceof Error ? queryError.message : null),
    login,
    logout,
    refreshUser,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 