import { Suspense } from "react";
import { HomeSkeleton } from "@/components/pages/home/skeleton";
import HomeClient from "@/components/pages/home/home";

export default async function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeClient />
    </Suspense>
  );
}
