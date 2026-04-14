
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  password: z.string().min(6, { message: "Passwort muss mindestens 6 Zeichen lang sein" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwörter stimmen nicht überein",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();

  // Extract token from URL manually since wouter doesn't parse query params automatically in useRoute
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: api.resetPassword,
    onSuccess: () => {
      toast.success(t("password_reset_success", { defaultValue: "Passwort erfolgreich geändert" }));
      setTimeout(() => setLocation("/login"), 1500);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!token) {
      toast.error(t("toast_no_token"));
      return;
    }
    resetPasswordMutation.mutate({ token, password: values.password });
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("invalid_link", { defaultValue: "Ungültiger Link" })}</CardTitle>
            <CardDescription>
              {t("invalid_link_desc", { defaultValue: "Der Link zum Zurücksetzen des Passworts fehlt oder ist ungültig." })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/login">{t("back_to_login", { defaultValue: "Zurück zum Login" })}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("reset_password", { defaultValue: "Neues Passwort festlegen" })}</CardTitle>
          <CardDescription>
            {t("reset_password_desc", { defaultValue: "Bitte gib dein neues Passwort ein." })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("new_password", { defaultValue: "Neues Passwort" })}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("confirm_password", { defaultValue: "Passwort bestätigen" })}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("save_password", { defaultValue: "Passwort speichern" })}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
