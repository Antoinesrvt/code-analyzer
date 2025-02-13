import { Suspense } from "react";
import { CallbackSkeleton } from "@/components/pages/callback/skeleton";
import CallbackHandler from "@/components/pages/callback/callback";
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

interface PageProps {
  params: Promise<{ [key: string]: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Page({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const code = resolvedSearchParams.code as string | undefined;
  const state = resolvedSearchParams.state as string | undefined;

  if (!code || !state) {
    redirect('/');
  }

  // Get the stored state from cookies
  const cookiesList = await cookies();
  const storedState = cookiesList.get('oauth_state');
  
  // Verify the state parameter
  if (!storedState || storedState.value !== state) {
    redirect('/');
  }

  return (
    <Suspense fallback={<CallbackSkeleton />}>
      <CallbackHandler code={code} state={state} />
    </Suspense>
  );
}
