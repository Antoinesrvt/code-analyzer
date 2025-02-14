export interface User {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
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

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  error_description?: string;
}

export interface AuthInitResponse {
  success: boolean;
  url?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

export interface SessionData {
  accessToken: string;
  tokenType: string;
  scope: string;
  createdAt: number;
  oauthState?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
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

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
} 