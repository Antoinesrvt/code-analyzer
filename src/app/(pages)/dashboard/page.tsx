import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/pages/dashboard/skeleton";
import DashboardClient from "@/components/pages/dashboard/dashboard";

export default async function DashboardPage() {
  // Any server-side data fetching can happen here
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient />
    </Suspense>
  );
}
