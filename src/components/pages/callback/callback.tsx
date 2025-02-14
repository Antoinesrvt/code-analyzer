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
  const { setLoading, setError, setUser } = store();

  useEffect(() => {
    async function handleCallback() {
      try {
        setLoading(true);

        const response = await fetch("/api/auth/github", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, state }),
          credentials: 'include',
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error_description || error.error || "Authentication failed");
        }

        // Get user data after successful authentication
        const userResponse = await fetch("/api/auth/status", {
          credentials: 'include',
        });
        
        if (!userResponse.ok) {
          throw new Error("Failed to get user data");
        }

        const userData = await userResponse.json();
        if (userData.user) {
          setUser(userData.user);
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
  }, [code, state, router, setError, setLoading, setUser]);

  return <CallbackSkeleton />;
}
