'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

interface AuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

export function CallbackHandler() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useAuthStore();
  const { setUser, setLoading: setAuthLoading, setError: setAuthError } = store();

  useEffect(() => {
    async function handleCallback() {
      try {
        // Check for OAuth error response
        const oauthError = searchParams.get('error');
        if (oauthError) {
          const description = searchParams.get('error_description');
          const uri = searchParams.get('error_uri');
          throw new Error(description || `Authentication failed: ${oauthError}`);
        }

        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code || !state) {
          setError('Missing required OAuth parameters');
          setLoading(false);
          return;
        }

        // Validate state parameter length (should be UUID)
        if (state.length !== 36) {
          throw new Error('Invalid state parameter');
        }

        setAuthLoading(true);

        // Exchange code for token with timeout
        const tokenPromise = fetch('/api/auth/github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ code, state }),
        });

        // Set a timeout of 10 seconds
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Authentication request timed out')), 10000);
        });

        const response = await Promise.race([tokenPromise, timeoutPromise]) as Response;

        if (!response.ok) {
          const data: AuthError = await response.json();
          throw new Error(
            data.error_description || 
            data.error || 
            'Failed to authenticate with GitHub'
          );
        }

        // Get user data with timeout
        const statusPromise = fetch('/api/auth/status', {
          credentials: 'include',
        });

        const statusResponse = await Promise.race([statusPromise, timeoutPromise]) as Response;

        if (!statusResponse.ok) {
          throw new Error('Failed to get user status');
        }

        const statusData = await statusResponse.json();
        
        if (statusData.isAuthenticated && statusData.user) {
          setUser(statusData.user);
          toast.success('Successfully signed in!', {
            description: `Welcome back, ${statusData.user.name || statusData.user.login}!`,
          });
          router.push('/dashboard');
        } else {
          throw new Error('Authentication failed: User data not available');
        }
      } catch (err) {
        console.error('Callback error:', err);
        const errorMessage = err instanceof Error ? err.message : 'An error occurred during authentication';
        setError(errorMessage);
        setAuthError(errorMessage);
        toast.error('Authentication failed', {
          description: errorMessage,
        });
      } finally {
        setLoading(false);
        setAuthLoading(false);
      }
    }

    handleCallback();
  }, [searchParams, router, setUser, setAuthLoading, setAuthError]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-2xl font-semibold text-gray-900">
            Completing authentication...
          </div>
          <div className="text-sm text-gray-600 mb-4">
            Verifying your GitHub credentials
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <div className="mb-4 text-2xl font-semibold text-red-600">Authentication Error</div>
          <div className="text-gray-600 mb-6">{error}</div>
          <div className="space-y-4">
            <button
              onClick={() => router.push('/')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       transition-colors duration-300 focus:outline-none focus:ring-2 
                       focus:ring-blue-500 focus:ring-offset-2"
            >
              Return Home
            </button>
            <button
              onClick={() => router.refresh()}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 
                       transition-colors duration-300 focus:outline-none focus:ring-2 
                       focus:ring-gray-500 focus:ring-offset-2"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
} 