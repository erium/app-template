import DashboardLayout from "@/components/DashboardLayout";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";
import { User, Globe, Building, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { api, queryKeys } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const queryClient = useQueryClient();

  // Tenant Settings Logic
  const tenantQuery = useQuery({
    queryKey: queryKeys.tenantSettings,
    queryFn: api.getTenantSettings,
  });
  const [tenantName, setTenantName] = useState("");

  useEffect(() => {
    if (tenantQuery.data?.name) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTenantName(tenantQuery.data.name);
    }
  }, [tenantQuery.data]);

  const updateTenantMutation = useMutation({
    mutationFn: (data: { name: string }) => api.updateTenantName(data),
    onSuccess: () => {
      toast.success(t("settings_saved", { defaultValue: "Einstellungen gespeichert" }));
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantSettings });
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const handleSaveTenant = () => {
    if (!tenantName.trim()) return;
    updateTenantMutation.mutate({ name: tenantName });
  };


  const deleteTenantMutation = useMutation({
    mutationFn: api.deleteTenant,
    onSuccess: () => {
      toast.success(t("org_deleted", { defaultValue: "Organisation gelöscht" }));
      queryClient.setQueryData(queryKeys.me, null);
      window.location.href = "/login";
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: () => {
      toast.success(t("account_deleted", { defaultValue: "Konto erfolgreich gelöscht" }));
      queryClient.setQueryData(queryKeys.me, null);
      window.location.href = "/login";
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const isAdmin = user?.role === 'admin';

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("settings")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("settings_subtitle", { defaultValue: "Verwalten Sie Ihre persönlichen Einstellungen und Präferenzen." })}
          </p>
        </div>

        <Separator />

        {/* Organization Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              <CardTitle>{t("organization", { defaultValue: "Organisation" })}</CardTitle>
            </div>
            <CardDescription>
              {t("organization_description", { defaultValue: "Informationen zu Ihrem Unternehmen." })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>{t("company_name", { defaultValue: "Firmenname" })}</Label>
              <div className="flex gap-2">
                <Input
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  disabled={!isAdmin}
                  placeholder={t("company_name")}
                />
                {isAdmin && (
                  <Button
                    onClick={handleSaveTenant}
                    disabled={updateTenantMutation.isPending || tenantName === tenantQuery.data?.name}
                  >
                    {updateTenantMutation.isPending ? "..." : t("save", { defaultValue: "Speichern" })}
                  </Button>
                )}
              </div>
              {!isAdmin && (
                <p className="text-xs text-muted-foreground">
                  {t("admin_only_edit", { defaultValue: "Nur Administratoren können den Firmennamen ändern." })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profile Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>{t("profile")}</CardTitle>
            </div>
            <CardDescription>
              {t("profile_description", { defaultValue: "Ihre persönlichen Daten." })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>{t("name", { defaultValue: "Name" })}</Label>
              <div className="p-3 bg-muted rounded-md text-sm">{user?.name}</div>
            </div>
            <div className="grid gap-2">
              <Label>{t("email", { defaultValue: "E-Mail-Adresse" })}</Label>
              <div className="p-3 bg-muted rounded-md text-sm">{user?.email}</div>
            </div>
          </CardContent>
        </Card>

        {/* Language Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle>{t("language")}</CardTitle>
            </div>
            <CardDescription>
              {t("language_description", { defaultValue: "Wählen Sie die Sprache der Benutzeroberfläche." })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>{t("current_language", { defaultValue: "Aktuelle Sprache" })}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("language_hint", { defaultValue: "Diese Einstellung wird in Ihrem Profil gespeichert." })}
                </p>
              </div>
              <LanguageSwitcher variant="outline" showLabel={true} />
            </div>
          </CardContent>
        </Card>


        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">{t("danger_zone", { defaultValue: "Gefahrenzone" })}</CardTitle>
            </div>
            <CardDescription>
              {t("danger_zone_desc", { defaultValue: "Diese Aktionen können nicht rückgängig gemacht werden." })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* DELETE ORGANIZATION (ADMIN ONLY) */}
            {isAdmin && (
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-destructive">{t("delete_org", { defaultValue: "Organisation löschen" })}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("delete_org_hint", { defaultValue: "Löscht die gesamte Organisation, alle Benutzer und alle Daten unwiderruflich." })}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">{t("delete_org_button", { defaultValue: "Organisation löschen" })}</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("delete_org_confirm_title", { defaultValue: "Organisation wirklich löschen?" })}</AlertDialogTitle>
                      <AlertDialogDescription>
                        <span className="block font-bold text-destructive mb-2">{t("delete_org_warning")}</span>
                        {t("delete_org_confirm_desc", { defaultValue: "Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten gehen verloren." })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleteTenantMutation.isPending}>{t("cancel", { defaultValue: "Abbrechen" })}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault();
                          deleteTenantMutation.mutate();
                        }}
                        disabled={deleteTenantMutation.isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteTenantMutation.isPending ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("deleting", { defaultValue: "Lösche..." })}</>
                        ) : (
                          t("delete_org_confirm_button", { defaultValue: "Ja, alles löschen" })
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* DELETE ACCOUNT */}
            <div className={`flex items-center justify-between ${isAdmin ? 'pt-4 border-t' : ''}`}>
              <div className="space-y-1">
                <Label className="text-destructive">{t("delete_account", { defaultValue: "Konto löschen" })}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("delete_account_hint", { defaultValue: "Löscht Ihr Konto und alle persönlichen Daten dauerhaft." })}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">{t("delete_account_button", { defaultValue: "Konto löschen" })}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("delete_account_confirm_title", { defaultValue: "Sind Sie sicher?" })}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("delete_account_confirm_desc", { defaultValue: "Diese Aktion kann nicht rückgängig gemacht werden. Ihr Konto wird dauerhaft gelöscht." })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteTenantMutation.isPending}>{t("cancel", { defaultValue: "Abbrechen" })}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteAccountMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {t("delete_account_confirm_button", { defaultValue: "Ja, Konto löschen" })}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>


      </div>
    </DashboardLayout>
  );
}
