"use client";

import { useState } from "react";
import { Link } from "@/lib/nav";
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
import { ArrowLeft, Loader2 } from "lucide-react";

const formSchema = z.object({
  email: z.string().email(),
});

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: api.forgotPassword,
    onSuccess: () => {
      setSubmitted(true);
      toast.success(t("forgot_password_sent", { defaultValue: "E-Mail wurde gesendet" }));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    forgotPasswordMutation.mutate(values);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{t("forgot_password", { defaultValue: "Passwort vergessen?" })}</CardTitle>
          <CardDescription>
            {submitted
              ? t("forgot_password_success_desc", { defaultValue: "Wir haben dir eine E-Mail mit einem Link zum Zurücksetzen deines Passworts gesendet." })
              : t("forgot_password_desc", { defaultValue: "Gib deine E-Mail-Adresse ein, um dein Passwort zurückzusetzen." })
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <Button asChild className="w-full" variant="outline">
                <Link href="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("back_to_login", { defaultValue: "Zurück zum Login" })}
                </Link>
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("email", { defaultValue: "E-Mail-Adresse" })}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("email_company_placeholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={forgotPasswordMutation.isPending}
                >
                  {forgotPasswordMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("send_reset_link", { defaultValue: "Link senden" })}
                </Button>

                <Button asChild variant="link" className="w-full">
                  <Link href="/login">
                    {t("back_to_login", { defaultValue: "Zurück zum Login" })}
                  </Link>
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
