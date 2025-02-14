'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    githubUser: null,
    dbUser: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/status', {
        credentials: 'include',
      });
      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        isAuthenticated: data.isAuthenticated,
        githubUser: data.user || null,
        dbUser: data.dbUser || null,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        githubUser: null,
        dbUser: null,
        isLoading: false,
        error: 'Failed to check authentication status',
      }));
    }
  };

  const login = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/auth/github', {
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error_description || data.error || 'Failed to initialize login');
      }

      if (!data.url) {
        throw new Error('No authorization URL returned');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Login error:', error);
      const message = error instanceof Error ? error.message : 'Failed to initialize login';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      toast.error('Login failed', {
        description: message,
      });
    }
  };

  const logout = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      setState({
        isAuthenticated: false,
        githubUser: null,
        dbUser: null,
        isLoading: false,
        error: null,
      });

      toast.success('Successfully logged out');
    } catch (error) {
      console.error('Logout error:', error);
      const message = error instanceof Error ? error.message : 'Failed to logout';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      toast.error('Logout failed', {
        description: message,
      });
    }
  };

  const refreshUser = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      await checkAuth();
    } catch (error) {
      console.error('Refresh error:', error);
      const message = error instanceof Error ? error.message : 'Failed to refresh user data';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      toast.error('Failed to refresh user data', {
        description: message,
      });
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        ...state, 
        login,
        logout,
        refreshUser,
      }}
    >
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