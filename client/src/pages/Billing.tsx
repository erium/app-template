import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, queryKeys } from "@/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  CreditCard,
  History,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "react-i18next";

export default function Billing() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: queryKeys.transactions,
    queryFn: api.getTransactions,
  });

  const { mutateAsync: createCheckoutSession, isPending } = useMutation({
    mutationFn: api.createCheckoutSession,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) {
      toast.success(t("payment_success"));
      refetchTransactions();
      window.history.replaceState({}, "", "/billing");
    }
    if (params.get("canceled")) {
      toast.error(t("payment_canceled"));
      window.history.replaceState({}, "", "/billing");
    }
  }, [refetchTransactions, t]);

  const handleCheckout = async () => {
    try {
      // Example: purchase 1000 credits for €10.00 (1000 cents)
      const { url } = await createCheckoutSession({ amount: 1000, credits: 1000 });
      if (url) window.location.href = url;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error(e);
      toast.error(message || t("error_start_payment"));
    }
  };

  if (user?.role === "viewer") {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">
          {t("billing_no_permission")}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("billing_title")}</h1>
          <p className="text-muted-foreground mt-2">{t("billing_desc")}</p>
        </div>

        {/* Example Checkout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> {t("billing_checkout_title")}
            </CardTitle>
            <CardDescription>{t("billing_checkout_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleCheckout} disabled={isPending} className="gap-2">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {t("billing_checkout_button")}
            </Button>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> {t("transaction_history")}
            </CardTitle>
            <CardDescription>{t("transaction_history_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !transactions || transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                {t("no_transactions")}
              </div>
            ) : (
              <div className="space-y-0 divide-y border rounded-lg overflow-hidden">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100 text-green-600 dark:bg-green-900/20">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium">{t("credit_purchase")}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString(undefined, {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">+{tx.credits} {t("credits")}</div>
                      <div className="text-xs text-muted-foreground">{(tx.amount / 100).toFixed(2)} €</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
