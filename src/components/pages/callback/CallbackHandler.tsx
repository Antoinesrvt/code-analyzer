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
    let mounted = true;

    async function completeAuthentication() {
      try {
        if (!mounted) return;
        setLoading(true);
        setError(null);

        // Exchange code for token
        const response = await fetch('/api/auth/github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ code, state }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error_description || data.error || 'Failed to authenticate with GitHub');
        }

        // Small delay to ensure token is properly set
        await new Promise(resolve => setTimeout(resolve, 500));

        // Get user data
        const statusResponse = await fetch('/api/auth/status', {
          credentials: 'include',
        });

        if (!statusResponse.ok) {
          throw new Error('Failed to get user status');
        }

        const statusData = await statusResponse.json();
        
        if (!mounted) return;

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
        if (!mounted) return;
        console.error('Authentication error:', err);
        const errorMessage = err instanceof Error ? err.message : 'An error occurred during authentication';
        setError(errorMessage);
        toast.error('Authentication failed', {
          description: errorMessage,
        });
        router.push(`/?error=${encodeURIComponent(errorMessage)}`);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    completeAuthentication();

    return () => {
      mounted = false;
    };
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