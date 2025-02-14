import { z } from 'zod';

const configSchema = z.object({
  github: z.object({
    clientId: z
      .string()
      .min(1, { message: "NEXT_PUBLIC_GITHUB_CLIENT_ID is required" }),
    clientSecret: z
      .string()
      .min(1, { message: "GITHUB_CLIENT_SECRET is required" }),
    redirectUri: z.string().url({ message: "Invalid redirect URI format" }),
    scopes: z
      .array(z.string())
      .min(1, { message: "At least one scope is required" }),
    apiBaseUrl: z.string().url({ message: "Invalid API base URL format" }),
  }),
  api: z.object({
    baseUrl: z.string().url({ message: "Invalid base URL format" }),
    timeout: z.number().min(1000),
    retryCount: z.number().min(1),
    rateLimitDelay: z.number().min(100),
  }),
  auth: z.object({
    loginPath: z.string(),
    callbackPath: z.string(),
    logoutPath: z.string(),
    sessionSecret: z
      .string()
      .min(32, { message: "Session secret must be at least 32 characters" }),
    sessionMaxAge: z.number().min(60), // minimum 1 minute
    cookieName: z.string().min(1),
    secureCookie: z.boolean(),
  }),
});

export type Config = z.infer<typeof configSchema>;

const config = {
  github: {
    clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    redirectUri: process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
      : "http://localhost:3000/auth/callback",
    scopes: ["repo", "read:user", "user:email"],
    apiBaseUrl: "https://api.github.com",
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    timeout: 10000, // 10 seconds
    retryCount: 3,
    rateLimitDelay: 1000, // 1 second
  },
  auth: {
    loginPath: "/auth/login",
    callbackPath: "/auth/callback",
    logoutPath: "/auth/logout",
    sessionSecret:
      process.env.SESSION_SECRET ||
      "your-development-only-secret-key-min-32-chars",
    sessionMaxAge: 60 * 60 * 24 * 7, // 1 week
    cookieName: "gh_session",
    secureCookie: process.env.NODE_ENV === "production",
  },
} as const;

// Validate config at runtime
try {
  configSchema.parse(config);
} catch (error) {
  console.error('Configuration validation failed:', error);
  throw error;
}

export { config }; 