'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setLoading, setError } = useAuthStore();

  useEffect(() => {
    async function handleCallback() {
      try {
        setLoading(true);
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code || !state) {
          throw new Error('Missing required parameters');
        }

        const response = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Authentication failed');
        }

        // Redirect to dashboard on success
        router.replace('/dashboard');
      } catch (error) {
        console.error('Auth callback error:', error);
        const message = error instanceof Error ? error.message : 'Authentication failed';
        setError(message);
        toast.error('Authentication failed', {
          description: message,
        });
        router.replace('/');
      } finally {
        setLoading(false);
      }
    }

    handleCallback();
  }, [router, searchParams, setError, setLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Completing Sign In
        </h2>
        <p className="text-gray-600">
          Please wait while we verify your credentials...
        </p>
      </motion.div>
    </div>
  );
} 