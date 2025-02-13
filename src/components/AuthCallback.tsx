import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { GitHubAuthService } from '../services/githubAuth';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code || !state) {
        setError('Missing required parameters');
        return;
      }

      try {
        const authService = GitHubAuthService.getInstance();
        const success = await authService.handleCallback(code, state);
        
        if (success) {
          // Redirect to dashboard on success
          navigate('/dashboard', { replace: true });
        } else {
          setError('Authentication failed');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        const error = err as Error;
        setError(error.message || 'Authentication failed');
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-500">
          <h2 className="mb-2 font-semibold">Authentication Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

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