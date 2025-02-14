import { Suspense } from 'react';
import { CallbackHandler } from '@/components/pages/callback/CallbackHandler';
import { redirect } from 'next/navigation';

export default function CallbackPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const code = searchParams.code;
  const state = searchParams.state;

  // Handle OAuth error response
  if (searchParams.error) {
    const errorDescription = searchParams.error_description || searchParams.error;
    redirect(`/?error=${encodeURIComponent(String(errorDescription))}`);
  }

  // Validate required parameters
  if (!code || !state || Array.isArray(code) || Array.isArray(state)) {
    redirect('/?error=Missing%20or%20invalid%20OAuth%20parameters');
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mb-4 text-2xl font-semibold text-gray-900">
              Initializing...
            </div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      }
    >
      <CallbackHandler code={code} state={state} />
    </Suspense>
  );
}
