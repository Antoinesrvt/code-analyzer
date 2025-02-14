import { motion } from 'framer-motion';
import { Github, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function LoginButton() {
  const store = useAuthStore();
  const { isAuthenticated, isLoading, setLoading, setError } = store();
  const router = useRouter();

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/github', {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || error.error || 'Failed to initialize login');
      }

      const data = await response.json();
      router.push(data.url);
    } catch (error) {
      console.error('Login error:', error);
      const message = error instanceof Error ? error.message : 'Failed to initialize login';
      setError(message);
      toast.error('Login failed', {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) return null;

  return (
    <motion.button
      onClick={handleLogin}
      disabled={isLoading}
      className={`
        flex items-center space-x-2 px-4 py-2 rounded-lg
        bg-gray-900 text-white
        hover:bg-gray-800 transition-colors duration-300
        focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Github className="w-5 h-5" />
      )}
      <span>{isLoading ? 'Connecting...' : 'Sign in with GitHub'}</span>
    </motion.button>
  );
}