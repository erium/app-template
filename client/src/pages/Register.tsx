import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { Loader2, UserPlus, Building2, MailCheck, Brain } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [success, setSuccess] = useState(false);

  const { t } = useTranslation();

  const registerMutation = useMutation({
    mutationFn: api.register,
    onSuccess: () => {
      setSuccess(true);
      toast.success(t("register_success"));
    },
    onError: (err) => {
      toast.error(err.message || t("register_failed"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ email, password, name, companyName });
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/30 p-4">
        <div className="absolute top-4 left-4 md:top-8 md:left-8">
            <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Brain className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold hidden md:inline-block">{t('app_name')}</span>
            </div>
            </Link>
        </div>

        <div className="w-full max-w-md">
          <Card className="shadow-xl border-border/50 text-center p-6">
            <div className="mx-auto bg-green-100 dark:bg-green-900/30 w-16 h-16 rounded-full flex items-center justify-center mb-6">
              <MailCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl mb-2">{t("almost_done")}</CardTitle>
            <CardDescription className="text-base mb-6">
              {t("confirmation_email_sent_1")} <strong>{email}</strong> {t("confirmation_email_sent_2")}
            </CardDescription>
            <div className="space-y-4">
              <Button asChild className="w-full" variant="outline">
                <Link href="/login">{t("to_login")}</Link>
              </Button>
              <p className="text-sm text-muted-foreground">
                {t("no_email_received")}
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-gradient-to-br from-background via-background to-accent/30 p-4">
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
            <CardTitle className="text-xl">{t("create_company_title")}</CardTitle>
            <CardDescription>
              {t("create_company_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">{t("company_name")}</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="company"
                    className="pl-9"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={t("company_placeholder")}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t("your_name")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("name_placeholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("email_label")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("email_placeholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("password_label")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("password_min_length")}
                  required
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {t("register_start_button")}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {t("have_account_text")}{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                {t("login_link")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
