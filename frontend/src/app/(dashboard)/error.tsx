"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="mt-2 text-muted-foreground max-w-md">
        An error occurred while loading this page. Please try again.
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
