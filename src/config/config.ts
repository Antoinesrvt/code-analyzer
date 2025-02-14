import { z } from 'zod';

// Helper function to get environment variables with better error messages
function getEnvVar(key: string, required: boolean = true): string {
  const value = process.env[key];
  if (required && (!value || value.length === 0)) {
    throw new Error(
      `Environment variable ${key} is required but not set. ` +
      `Please check your .env file and make sure it's properly loaded.`
    );
  }
  return value || '';
}

const configSchema = z.object({
  github: z.object({
    clientId: z.string().min(1, {
      message: "NEXT_PUBLIC_GITHUB_CLIENT_ID is required in your environment variables"
    }),
    clientSecret: z.string().min(1, {
      message: "GITHUB_CLIENT_SECRET is required in your environment variables"
    }),
    redirectUri: z.string().url({
      message: "Invalid redirect URI format. Please check your NEXT_PUBLIC_APP_URL"
    }),
    scopes: z.array(z.string()).min(1, {
      message: "At least one GitHub scope is required"
    }),
    apiBaseUrl: z.string().url({
      message: "Invalid GitHub API base URL format"
    }),
  }),
  api: z.object({
    baseUrl: z.string().url({
      message: "Invalid base URL format. Please check your NEXT_PUBLIC_APP_URL"
    }),
    timeout: z.number().min(1000),
    retryCount: z.number().min(1),
    rateLimitDelay: z.number().min(100),
  }),
  auth: z.object({
    loginPath: z.string(),
    callbackPath: z.string(),
    logoutPath: z.string(),
    sessionSecret: z.string().min(32, {
      message: "SESSION_SECRET must be at least 32 characters long"
    }),
    sessionMaxAge: z.number().min(60),
    cookieName: z.string().min(1),
    secureCookie: z.boolean(),
  }),
});

export type Config = z.infer<typeof configSchema>;

// Get environment variables with validation
const githubClientId = getEnvVar('NEXT_PUBLIC_GITHUB_CLIENT_ID');
const githubClientSecret = getEnvVar('GITHUB_CLIENT_SECRET');
const appUrl = getEnvVar('NEXT_PUBLIC_APP_URL', false) || 'http://localhost:3000';
const sessionSecret = getEnvVar('SESSION_SECRET');

const config = {
  github: {
    clientId: githubClientId,
    clientSecret: githubClientSecret,
    redirectUri: `${appUrl}/auth/callback`,
    scopes: ['repo', 'read:user', 'user:email'],
    apiBaseUrl: 'https://api.github.com',
  },
  api: {
    baseUrl: appUrl,
    timeout: 10000,
    retryCount: 3,
    rateLimitDelay: 1000,
  },
  auth: {
    loginPath: '/auth/login',
    callbackPath: '/auth/callback',
    logoutPath: '/auth/logout',
    sessionSecret: sessionSecret,
    sessionMaxAge: 60 * 60 * 24 * 7, // 1 week
    cookieName: 'gh_session',
    secureCookie: process.env.NODE_ENV === 'production',
  },
} as const;

// Validate config at runtime
try {
  configSchema.parse(config);
} catch (error) {
  console.error('Configuration validation failed. Please check your environment variables:');
  if (error instanceof z.ZodError) {
    error.errors.forEach((err) => {
      console.error(`- ${err.message}`);
      if (err.path) {
        console.error(`  Path: ${err.path.join('.')}`);
      }
    });
  }
  throw error;
}

export { config }; 