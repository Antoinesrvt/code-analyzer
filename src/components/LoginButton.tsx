import { motion } from 'framer-motion';
import { Github } from 'lucide-react';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';

export function LoginButton() {
  const { isAuthenticated, isLoading } = useAuthStore();

  const handleLogin = async () => {
    const loginUrl = await authService.initiateLogin();
    window.location.href = loginUrl;
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
      <Github className="w-5 h-5" />
      <span>{isLoading ? 'Connecting...' : 'Sign in with GitHub'}</span>
    </motion.button>
  );
}