"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ApiError } from "@/lib/api";
import "@/lib/i18n";

function redirectToLoginIfUnauthorized(error: unknown) {
  if (!(error instanceof ApiError)) return;
  if (typeof window === "undefined") return;
  if ((error as ApiError).status === 401) {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    window.location.href = `${base}/login`;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const qc = new QueryClient();
    qc.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        redirectToLoginIfUnauthorized(event.query.state.error);
        console.error("[API Query Error]", event.query.state.error);
      }
    });
    qc.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        redirectToLoginIfUnauthorized(event.mutation.state.error);
        console.error("[API Mutation Error]", event.mutation.state.error);
      }
    });
    return qc;
  });

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
