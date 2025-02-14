'use client';

import { CallbackHandler } from '@/components/pages/callback/CallbackHandler';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AuthCallback() {
  // Get the code and state from the URL
  const params = typeof window !== 'undefined' 
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
    
  const code = params.get('code');
  const state = params.get('state');

  if (!code || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-red-500">
          <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
          <p>Missing required parameters</p>
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
        <CallbackHandler code={code} state={state} />
      </motion.div>
    </div>
  );
}