'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';
import type { AuthResponse } from '@/types/auth';

interface CallbackHandlerProps {
  code: string;
  state: string;
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

        // Exchange code for token and get user data
        const response = await fetch('/api/auth/github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ code, state }),
        });

        const data: AuthResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error_description || data.error || 'Failed to authenticate with GitHub');
        }

        if (!mounted) return;

        if (data.user) {
          setUser(data.user);
          toast.success('Successfully signed in!', {
            description: `Welcome back, ${data.user.name || data.user.login}!`,
          });
          router.push('/dashboard');
        } else {
          throw new Error('Authentication failed: No user data received');
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