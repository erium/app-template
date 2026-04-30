"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, queryKeys } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserCheck } from "lucide-react";
import { useState } from "react";
import { useRouter } from "@/lib/nav";
import { toast } from "sonner";

export default function Join() {
  const { t } = useTranslation();

  const router = useRouter();
  const [token] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  });
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const queryClient = useQueryClient();

  const joinMutation = useMutation({
    mutationFn: api.join,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      toast.success(t("toast_invite_accepted"));
      router.push("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message || t("toast_join_failed"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
        toast.error(t("toast_no_invite_token"));
        return;
    }
    joinMutation.mutate({ token, password, name });
  };

  if (!token) {
     return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card>
                <CardHeader><CardTitle>{t("invalid_link")}</CardTitle></CardHeader>
                <CardContent>{t("check_invite_link")}</CardContent>
            </Card>
        </div>
     );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t('app_name')}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {t("join.title")}
          </p>
        </div>

        <Card className="shadow-xl border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">{t("join_team")}</CardTitle>
            <CardDescription>{t("complete_profile")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("your_name")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("name_placeholder")}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("set_password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("min_6_chars")}
                  required
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={joinMutation.isPending}
              >
                {joinMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserCheck className="mr-2 h-4 w-4" />
                )}
                {t("join.title")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
