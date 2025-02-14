import { z } from 'zod';

// Helper function to get environment variables with better error messages
function getEnvVar(key: string, required: boolean = true, defaultValue: string = ''): string {
  // Check if we're on the client side
  const isClient = typeof window !== 'undefined';
  const value = process.env[key];

  if (required && (!value || value.length === 0)) {
    throw new Error(
      `Environment variable ${key} is required but not set. ` +
      `Please check your .env file and make sure it's properly loaded.`
    );
  }

  return value || defaultValue;
}

// Separate schema for client-side validation
const clientConfigSchema = z.object({
  github: z.object({
    clientId: z.string().min(1, {
      message: "NEXT_PUBLIC_GITHUB_CLIENT_ID is required in your environment variables"
    }),
    redirectUri: z.string(),
    scopes: z.array(z.string()).min(1),
    apiBaseUrl: z.string().url(),
  }),
  api: z.object({
    baseUrl: z.string(),
    timeout: z.number().min(1000),
    retryCount: z.number().min(1),
    rateLimitDelay: z.number().min(100),
  }),
  auth: z.object({
    loginPath: z.string(),
    callbackPath: z.string(),
    logoutPath: z.string(),
    cookieName: z.string().min(1),
    secureCookie: z.boolean(),
  }),
});

// Full schema including server-side only fields
const serverConfigSchema = clientConfigSchema.extend({
  github: clientConfigSchema.shape.github.extend({
    clientSecret: z.string().min(1),
  }),
  auth: clientConfigSchema.shape.auth.extend({
    sessionSecret: z.string().min(32),
    sessionMaxAge: z.number().min(60),
  }),
});

export type Config = z.infer<typeof serverConfigSchema>;
export type ClientConfig = z.infer<typeof clientConfigSchema>;

const isClient = typeof window !== 'undefined';

// Get environment variables with validation
const githubClientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '';
const githubClientSecret = !isClient ? (process.env.GITHUB_CLIENT_SECRET || '') : '';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const sessionSecret = !isClient ? (process.env.SESSION_SECRET || '') : '';

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

// Validate config based on environment
try {
  if (isClient) {
    // On client-side, only validate public config
    const clientConfig = {
      ...config,
      github: {
        ...config.github,
        clientSecret: undefined,
      },
      auth: {
        ...config.auth,
        sessionSecret: undefined,
        sessionMaxAge: undefined,
      },
    };
    clientConfigSchema.parse(clientConfig);
  } else {
    // On server-side, validate full config
    serverConfigSchema.parse(config);
  }
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