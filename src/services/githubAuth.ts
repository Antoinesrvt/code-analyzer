import { config } from '@/config/config';

export class GitHubAuthService {
  private static instance: GitHubAuthService;

  private constructor() {}

  public static getInstance(): GitHubAuthService {
    if (!GitHubAuthService.instance) {
      GitHubAuthService.instance = new GitHubAuthService();
    }
    return GitHubAuthService.instance;
  }

  public async initiateLogin(): Promise<string> {
    // Request a state token from the server
    const response = await fetch('/api/auth/state', {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to initialize login');
    }

    const { state } = await response.json();

    // Build the GitHub OAuth URL
    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: config.github.redirectUri,
      scope: config.github.scopes.join(' '),
      state,
    });

    return `https://github.com/login/oauth/authorize?${params}`;
  }

  public async handleCallback(code: string, state: string): Promise<boolean> {
    const response = await fetch('/api/auth/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, state }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || error.error || 'Authentication failed');
    }

    const data = await response.json();
    return data.success;
  }

  public async logout(): Promise<void> {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || error.error || 'Logout failed');
    }
  }
} 