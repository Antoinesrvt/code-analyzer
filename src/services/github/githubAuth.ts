import { config } from '@/config/config';

export class GitHubAuthService {
  private static instance: GitHubAuthService | null = null;

  private constructor() {}

  public static getInstance(): GitHubAuthService {
    if (typeof window === 'undefined') {
      // Return a dummy instance for SSR that does nothing
      return new GitHubAuthService();
    }

    if (!GitHubAuthService.instance) {
      GitHubAuthService.instance = new GitHubAuthService();
    }
    return GitHubAuthService.instance;
  }

  public async initiateLogin(): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('Cannot initiate login during SSR');
    }

    // Build the GitHub OAuth URL
    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: config.github.redirectUri,
      scope: config.github.scopes.join(' '),
      state: crypto.randomUUID(),
    });

    return `https://github.com/login/oauth/authorize?${params}`;
  }

  public async exchangeCodeForToken(code: string, state: string): Promise<{ 
    access_token: string;
    token_type: string;
    scope: string;
  }> {
    const response = await fetch('/api/auth/github', {
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

    return response.json();
  }

  public async getCurrentUser(accessToken: string) {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }

    return response.json();
  }

  public async logout(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Cannot logout during SSR');
    }

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

export const githubAuthService = GitHubAuthService.getInstance(); 