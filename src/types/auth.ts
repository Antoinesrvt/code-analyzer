export interface User {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
  type: 'User' | 'Organization';
}

export interface Repository {
  id: number;
  name: string;
  fullName: string;
  description: string;
  owner: User;
  url: string;
  gitUrl: string;
  sshUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  visibility: 'public' | 'private' | 'internal';
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  isPrivate: boolean;
  isFork: boolean;
  permissions: {
    admin: boolean;
    maintain?: boolean;
    push: boolean;
    triage?: boolean;
    pull: boolean;
  };
  topics: string[];
  language: string | null;
  size: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: User | null;
}

export interface AuthStore extends AuthState {
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export interface GitHubError {
  error: string;
  error_description?: string;
}

export interface AuthResponse {
  success: boolean;
  error?: GitHubError;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
} 