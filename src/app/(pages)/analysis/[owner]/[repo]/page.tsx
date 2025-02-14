import { Suspense } from "react";
import { AnalysisPageSkeleton } from "@/components/pages/analysis/skeleton";
import { AnalysisPage } from "@/components/pages/analysis/AnalysisPage";
import { notFound } from "next/navigation";

interface AnalysisPageProps {
  params: {
    owner: string;
    repo: string;
  };
}

export default async function ProjectAnalysisPage({ params }: AnalysisPageProps) {
  if (!params.owner || !params.repo) {
    notFound();
  }

  return (
    <Suspense fallback={<AnalysisPageSkeleton />}>
      <AnalysisPage owner={params.owner} repo={params.repo} />
    </Suspense>
  );
} 