"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/store/useAuthStore";
import { CallbackSkeleton } from './skeleton';

interface CallbackHandlerProps {
  code: string;
  state: string;
}

export default function CallbackHandler({ code, state }: CallbackHandlerProps) {
  const router = useRouter();
  const store = useAuthStore();
  const { setLoading, setError } = store();

  useEffect(() => {
    async function handleCallback() {
      try {
        setLoading(true);

        const response = await fetch("/api/auth/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, state }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Authentication failed");
        }

        // Redirect to dashboard on success
        router.replace("/dashboard");
      } catch (error) {
        console.error("Auth callback error:", error);
        const message =
          error instanceof Error ? error.message : "Authentication failed";
        setError(message);
        toast.error("Authentication failed", {
          description: message,
        });
        router.replace("/");
      } finally {
        setLoading(false);
      }
    }

    handleCallback();
  }, [code, state, router, setError, setLoading]);

  return <CallbackSkeleton />;
}
