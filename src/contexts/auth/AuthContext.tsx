'use client';

import { createContext, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { User } from '@/types/auth';
import type { IUser } from '@/models/User';

interface AuthState {
  isAuthenticated: boolean;
  githubUser: User | null;
  dbUser: IUser | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// API functions
async function checkAuthStatus() {
  const response = await fetch('/api/auth/status', {
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Failed to check authentication status');
  }
  
  const data = await response.json();
  return {
    isAuthenticated: data.isAuthenticated,
    githubUser: data.user || null,
    dbUser: data.dbUser || null,
  };
}

async function initiateLogin() {
  const response = await fetch('/api/auth/github', {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Failed to initialize login');
  }

  const data = await response.json();
  if (!data.url) {
    throw new Error('No authorization URL returned');
  }

  return data;
}

async function logoutUser() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Failed to logout');
  }

  return response.json();
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  // Auth status query
  const { data: authData, isLoading, error } = useQuery({
    queryKey: ['auth'],
    queryFn: checkAuthStatus,
    retry: 2,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 60 * 30, // 30 minutes
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: initiateLogin,
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error('Login failed', {
        description: error instanceof Error ? error.message : 'Failed to initialize login'
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.setQueryData(['auth'], {
        isAuthenticated: false,
        githubUser: null,
        dbUser: null,
      });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast.success('Successfully logged out');
    },
    onError: (error) => {
      toast.error('Logout failed', {
        description: error instanceof Error ? error.message : 'Failed to logout'
      });
    },
  });

  const login = async () => {
    await loginMutation.mutateAsync();
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const refreshUser = async () => {
    await queryClient.invalidateQueries({ queryKey: ['auth'] });
  };

  const value: AuthContextType = {
    isAuthenticated: authData?.isAuthenticated ?? false,
    githubUser: authData?.githubUser ?? null,
    dbUser: authData?.dbUser ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    login,
    logout,
    refreshUser,
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