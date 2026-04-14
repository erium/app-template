import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, queryKeys } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogIn, Brain } from "lucide-react";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data.user);
      setLocation("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message || t("login_failed"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-gradient-to-br from-background via-background to-accent/30 p-4">
      {/* Top Left Logo / Back Link */}
      <div className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-4">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold hidden md:inline-block">{t('app_name')}</span>
          </div>
        </Link>
      </div>

      <div className="absolute top-4 right-4 md:top-8 md:right-8">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md">
        {/* Centered Brand Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            DE\<span className="text-foreground">Instruct</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {t("tagline")}
          </p>
        </div>

        <Card className="shadow-xl border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">{t("login_title")}</CardTitle>
            <CardDescription>
              {t("login_description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email_label")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("email_placeholder")}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label htmlFor="password">{t("password_label")}</Label><Link href="/forgot-password"><span className="text-sm text-primary hover:underline cursor-pointer">{t("forgot_password", { defaultValue: "Passwort vergessen?" })}</span></Link></div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("password_placeholder")}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                {t("login_button")}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {t("no_account_text")}{" "}
              <Link href="/register" className="text-primary hover:underline font-medium">
                {t("register_link")}
              </Link>
            </div>
          </CardContent>
        </Card>
        <div className="mt-8 text-center text-xs text-muted-foreground space-x-4">
          <Link href="/impressum" className="hover:underline hover:text-primary transition-colors">{t("imprint")}</Link>
          <Link href="/datenschutz" className="hover:underline hover:text-primary transition-colors">{t("privacy.title")}</Link>
          <Link href="/terms" className="hover:underline hover:text-primary transition-colors">{t("terms.title")}</Link>
        </div>
      </div>
    </div>
  );
}
