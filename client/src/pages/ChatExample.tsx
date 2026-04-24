import DashboardLayout from "@/components/DashboardLayout";
import ChatExampleComponent from "@/components/chat/ChatExample";
import { useTranslation } from "react-i18next";

export default function ChatExample() {
  const { t } = useTranslation();
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("chat_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("chat_subtitle")}</p>
        </div>
        <ChatExampleComponent />
      </div>
    </DashboardLayout>
  );
}
