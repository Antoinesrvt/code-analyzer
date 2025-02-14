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
  const sessionCookie = cookiesList.get('gh_session');
  
  if (!sessionCookie?.value) {
    redirect('/');
  }

  try {
    const session = JSON.parse(sessionCookie.value);
    // Verify the state parameter
    if (!session?.oauthState?.value || session.oauthState.value !== state) {
      redirect('/');
    }
  } catch (error) {
    console.error('Failed to parse session:', error);
    redirect('/');
  }

  return (
    <Suspense fallback={<CallbackSkeleton />}>
      <CallbackHandler code={code} state={state} />
    </Suspense>
  );
}
