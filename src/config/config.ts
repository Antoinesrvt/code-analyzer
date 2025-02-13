import { z } from 'zod';

const configSchema = z.object({
  github: z.object({
    clientId: z.string(),
    clientSecret: z.string(),
    redirectUri: z.string(),
    scopes: z.array(z.string()),
    apiBaseUrl: z.string(),
  }),
  api: z.object({
    baseUrl: z.string(),
    timeout: z.number(),
    retryCount: z.number(),
    rateLimitDelay: z.number(),
  }),
  auth: z.object({
    loginPath: z.string(),
    callbackPath: z.string(),
    logoutPath: z.string(),
  }),
});

export type Config = z.infer<typeof configSchema>;

const config = {
  github: {
    clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    redirectUri: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` : 'http://localhost:3000/auth/callback',
    scopes: ['repo', 'read:user', 'user:email'],
    apiBaseUrl: 'https://api.github.com',
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    timeout: 10000, // 10 seconds
    retryCount: 3,
    rateLimitDelay: 1000, // 1 second
  },
  auth: {
    loginPath: '/auth/login',
    callbackPath: '/auth/callback',
    logoutPath: '/auth/logout',
  },
} as const;

// Validate config at runtime
configSchema.parse(config);

export { config }; 