import type { User } from '../../../src/types/auth';

interface OAuthState {
  value: string;
  timestamp: number;
}

export interface GitHubSession {
  userId?: string;
  accessToken?: string;
  tokenType?: string;
  scope?: string;
  isAuthenticated: boolean;
  user?: User | null;
  oauthState?: OAuthState;
}

export interface SessionError {
  code: string;
  message: string;
}

export type SessionResponse<T = void> = {
  success: boolean;
  data?: T;
  error?: SessionError;
} 