// src/services/authService.ts
import type { AuthState, User, Repository } from '@/types/auth';
import { config } from '@/config/config';
import type { SearchReposParameters } from '@/types/github';

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
};

const defaultAuthState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  error: null,
  user: null,
};

/**
 * Service for handling authentication state and making authenticated requests
 */
export class AuthService {
  private static instance: AuthService | null = null;
  private authState: AuthState;
  private initialized: boolean = false;

  private constructor() {
    this.authState = { ...defaultAuthState };
  }

  public static getInstance(): AuthService {
    if (typeof window === 'undefined') {
      // Return a dummy instance for SSR that does nothing
      const dummyInstance = new AuthService();
      dummyInstance.authState = {
        ...defaultAuthState,
        isLoading: false,
      };
      return dummyInstance;
    }

    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private async initialize() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;
    await this.checkAuthStatus();
  }

  private async checkAuthStatus(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const response = await fetch(`${getBaseUrl()}/api/auth/status`);
      const data = await response.json();
      
      this.authState = {
        isAuthenticated: data.isAuthenticated,
        isLoading: false,
        user: data.user || null,
        error: null,
      };
    } catch (error) {
      console.error('Failed to check auth status:', error);
      this.authState = {
        isAuthenticated: false,
        isLoading: false,
        error: 'Failed to check authentication status',
        user: null,
      };
    }
  }

  public async initiateLogin(): Promise<string> {
    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: config.github.redirectUri,
      scope: config.github.scopes.join(' '),
      state: crypto.randomUUID(),
    });

    return `https://github.com/login/oauth/authorize?${params}`;
  }

  public async getCurrentUser(): Promise<User> {
    await this.initialize();
    const response = await fetch(`${getBaseUrl()}/api/github/user`);
    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }
    return response.json();
  }

  public async getUserRepositories(): Promise<Repository[]> {
    const response = await this.makeAuthenticatedRequest('/user/repos?sort=updated&per_page=100');
    if (!response.ok) {
      throw new Error('Failed to fetch repositories');
    }
    return response.json();
  }

  public async searchRepositories(params: SearchReposParameters): Promise<Repository[]> {
    const searchParams = new URLSearchParams({
      q: params.q,
      sort: params.sort || 'updated',
      order: params.order || 'desc',
      per_page: String(params.per_page || 100),
      page: String(params.page || 1),
    });

    const response = await this.makeAuthenticatedRequest(`/search/repositories?${searchParams}`);
    if (!response.ok) {
      throw new Error('Failed to search repositories');
    }
    const data = await response.json();
    return data.items;
  }

  public getAuthState(): AuthState {
    if (typeof window !== 'undefined' && !this.initialized) {
      this.initialize();
    }
    return { ...this.authState };
  }

  public async makeAuthenticatedRequest(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    await this.initialize();
    const response = await fetch(`${getBaseUrl()}/api/github${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      this.authState = {
        isAuthenticated: false,
        isLoading: false,
        error: 'Session expired',
        user: null,
      };
      throw new Error('Authentication required');
    }

    return response;
  }

  public async logout(): Promise<void> {
    await this.initialize();
    try {
      const response = await fetch(`${getBaseUrl()}/api/auth/logout`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      this.authState = {
        isAuthenticated: false,
        isLoading: false,
        error: null,
        user: null,
      };
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance(); 