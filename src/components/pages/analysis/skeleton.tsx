import { Loader2 } from "lucide-react";

export function AnalysisPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header Skeleton */}
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
        </div>
      </header>

      <main className="container py-8">
        {/* Title Skeleton */}
        <div className="space-y-4 mb-8">
          <div className="h-8 w-64 bg-muted animate-pulse rounded-md" />
          <div className="h-4 w-96 bg-muted animate-pulse rounded-md" />
        </div>

        {/* Content Skeleton */}
        <div className="grid gap-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-card animate-pulse rounded-lg border"
              />
            ))}
          </div>

          {/* Main Content Area */}
          <div className="h-[600px] bg-card animate-pulse rounded-lg border">
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 