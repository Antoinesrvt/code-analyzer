'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

interface CallbackHandlerProps {
  code: string;
  state: string;
}

interface AuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

export function CallbackHandler({ code, state }: CallbackHandlerProps) {
  const router = useRouter();
  const store = useAuthStore();
  const { setUser, setLoading, setError } = store();

  useEffect(() => {
    async function completeAuthentication() {
      try {
        setLoading(true);

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
        console.error('Authentication error:', err);
        const errorMessage = err instanceof Error ? err.message : 'An error occurred during authentication';
        setError(errorMessage);
        toast.error('Authentication failed', {
          description: errorMessage,
        });
        router.push(`/?error=${encodeURIComponent(errorMessage)}`);
      } finally {
        setLoading(false);
      }
    }

    completeAuthentication();
  }, [code, state, router, setUser, setLoading, setError]);

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