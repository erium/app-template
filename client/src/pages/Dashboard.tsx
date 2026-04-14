import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "react-i18next";
import { api, queryKeys } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Settings, Users, CreditCard, Rocket } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();

  // Live API call: fetch organization name
  const tenantQuery = useQuery({
    queryKey: queryKeys.tenantSettings,
    queryFn: api.getTenantSettings,
  });

  const roleLabel =
    user?.role === "admin" ? "Admin" :
    user?.role === "editor" ? "Editor" : "Viewer";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("welcome_user", { name: user?.name || t("welcome_default") })}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="secondary">{roleLabel}</Badge>
            {tenantQuery.data && (
              <span className="text-sm text-muted-foreground">
                {tenantQuery.data.name}
              </span>
            )}
          </div>
        </div>

        {/* Getting Started cards */}
        <div>
          <h2 className="text-lg font-semibold mb-4">{t("dashboard_getting_started")}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link href="/settings">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Settings className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{t("dashboard_card_settings_title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{t("dashboard_card_settings_desc")}</CardDescription>
                </CardContent>
              </Card>
            </Link>

            {user?.role === "admin" && (
              <Link href="/admin/users">
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{t("dashboard_card_users_title")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{t("dashboard_card_users_desc")}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            )}

            {user?.role === "admin" && (
              <Link href="/billing">
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <CreditCard className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{t("dashboard_card_billing_title")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{t("dashboard_card_billing_desc")}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            )}

            <Card className="border-dashed h-full">
              <CardHeader className="pb-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-2">
                  <Rocket className="w-5 h-5 text-muted-foreground" />
                </div>
                <CardTitle className="text-base">{t("dashboard_card_extend_title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{t("dashboard_card_extend_desc")}</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
