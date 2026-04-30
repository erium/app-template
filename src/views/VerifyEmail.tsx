"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, MailCheck } from "lucide-react";
import { Link, useRouter } from "@/lib/nav";
import { useTranslation } from "react-i18next";

export default function VerifyEmail() {
  const router = useRouter();
  const { t } = useTranslation();
  const [status, setStatus] = useState<"verifying" | "success" | "error" | "missing">("verifying");

  const verifyMutation = useMutation({ mutationFn: api.verifyEmail });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("missing");
      return;
    }

    verifyMutation.mutate({ token }, {
      onSuccess: () => {
        setStatus("success");
        // Redirect after 3 seconds
        setTimeout(() => router.push("/dashboard"), 3000);
      },
      onError: () => {
        setStatus("error");
      }
    });

    // Run only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
            <MailCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{t("email_verification")}</CardTitle>
          <CardDescription>{t("verifying_link")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center min-h-[160px] space-y-4">

          {status === "verifying" && (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t("please_wait")}</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="text-center space-y-1">
                <h3 className="font-semibold text-lg">{t("email_verified")}</h3>
                <p className="text-sm text-muted-foreground">{t("redirecting")}</p>
              </div>
              <Button asChild className="mt-4">
                <Link href="/dashboard">{t("to_dashboard")}</Link>
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
              <XCircle className="h-12 w-12 text-red-500" />
              <div className="text-center space-y-1">
                <h3 className="font-semibold text-lg">{t("error")}</h3>
                <p className="text-sm text-muted-foreground">{t("link_invalid_expired")}</p>
              </div>
              <Button variant="outline" asChild className="mt-4">
                <Link href="/login">{t("to_login")}</Link>
              </Button>
            </div>
          )}

          {status === "missing" && (
            <div className="flex flex-col items-center space-y-4">
              <XCircle className="h-12 w-12 text-yellow-500" />
              <div className="text-center space-y-1">
                <h3 className="font-semibold text-lg">{t("no_token")}</h3>
                <p className="text-sm text-muted-foreground">{t("no_token_found")}</p>
              </div>
              <Button variant="outline" asChild className="mt-4">
                <Link href="/login">{t("to_login")}</Link>
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
