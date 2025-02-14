import { Suspense } from 'react';
import { CallbackHandler } from '@/components/pages/callback/CallbackHandler';
import { CallbackLoading } from '@/components/pages/callback/loading';

export default function CallbackPage() {
  return (
    <Suspense fallback={<CallbackLoading />}>
      <CallbackHandler />
    </Suspense>
  );
}
