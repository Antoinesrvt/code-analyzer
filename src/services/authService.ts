// src/services/authService.ts
import type { AuthState, User, Repository } from '@/types/auth';
import { config } from '@/config/config';
import type { SearchReposParameters } from '@/types/github';

/**
 * Service for handling authentication state and making authenticated requests
 */
export class AuthService {
  private static instance: AuthService;
  private authState: AuthState;

  private constructor() {
    this.authState = {
      isAuthenticated: false,
      isLoading: true,
      error: null,
      user: null,
    };
    this.checkAuthStatus();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private async checkAuthStatus(): Promise<void> {
    try {
      const response = await fetch('/api/auth/status');
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
    const response = await fetch('/api/github/user');
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
    return { ...this.authState };
  }

  public async makeAuthenticatedRequest(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const response = await fetch(`/api/github${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Session expired or invalid
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
    try {
      const response = await fetch('/api/auth/logout', {
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