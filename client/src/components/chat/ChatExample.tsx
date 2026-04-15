import { useChat } from "@ai-sdk/react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getApiBase } from "@/lib/basePath";
import { Send } from "lucide-react";

export default function ChatExample() {
  const { t } = useTranslation();
  const { messages, input, handleInputChange, handleSubmit, status, error } = useChat({
    api: `${getApiBase()}/chat`,
    credentials: "include",
  });

  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <Card className="h-[70vh] flex flex-col">
      <CardHeader>
        <CardTitle>{t("chat_title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        <ScrollArea className="flex-1 rounded-md border p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("chat_empty")}</p>
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <div key={m.id} className="text-sm">
                  <div className="font-semibold mb-1">
                    {m.role === "user" ? t("chat_role_user") : t("chat_role_assistant")}
                  </div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {error && (
          <p className="text-sm text-destructive">
            {error.message.includes("not configured")
              ? t("chat_error_not_configured")
              : t("chat_error_generic")}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={handleInputChange}
            placeholder={t("chat_placeholder")}
            disabled={isStreaming}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button type="submit" disabled={isStreaming || !input.trim()}>
            <Send className="w-4 h-4 mr-2" />
            {t("chat_send")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
