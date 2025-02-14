import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/auth/AuthContext";
import { RepositoryProvider } from "@/contexts/repository/RepositoryContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GitHub Code Analyzer",
  description: "Analyze your GitHub repositories for insights and metrics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <AuthProvider>
            <RepositoryProvider>
              {children}
              <Toaster
                position="bottom-center"
                expand={true}
                richColors
                closeButton
                duration={5000}
                visibleToasts={3}
                toastOptions={{
                  style: { background: "white" },
                  className: "border border-gray-200",
                  descriptionClassName: "text-gray-500",
                }}
              />
            </RepositoryProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
