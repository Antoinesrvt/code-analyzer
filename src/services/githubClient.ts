import { Octokit } from '@octokit/rest';
import type { OctokitOptions } from '@octokit/core';
import type { RequestParameters } from '@octokit/types';
import { config } from '@/config/config';

interface RetryOptions {
  retryAfter: number;
  options: RequestParameters;
  octokit: Octokit;
  retryCount: number;
}

const MAX_RETRIES = config.api.retryCount;

function handleRateLimit({ retryAfter, retryCount }: RetryOptions): boolean {
  if (retryCount < MAX_RETRIES) {
    console.warn(`Rate limit hit, retrying after ${retryAfter} seconds`);
    return true;
  }
  return false;
}

function handleSecondaryRateLimit({ retryAfter, retryCount }: RetryOptions): boolean {
  if (retryCount < MAX_RETRIES) {
    console.warn(`Secondary rate limit hit, retrying after ${retryAfter} seconds`);
    return true;
  }
  return false;
}

const defaultOptions: Partial<OctokitOptions> = {
  baseUrl: config.github.apiBaseUrl,
  request: {
    timeout: config.api.timeout
  },
  retry: {
    enabled: true,
    retries: MAX_RETRIES,
    doNotRetry: ['429', '404', '403', '401'],
  },
  throttle: {
    enabled: true,
    onRateLimit: handleRateLimit,
    onSecondaryRateLimit: handleSecondaryRateLimit
  }
};

export function createGitHubClient(token: string): Octokit {
  // Ensure token has proper format
  const bearerToken = token.startsWith('bearer ') ? token : `bearer ${token}`;
  
  return new Octokit({
    ...defaultOptions,
    auth: bearerToken,
  });
} 