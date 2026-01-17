import { Card, CardContent } from "@/components/ui/card";
import { type SmsMessageResponse } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface SmsMessageCardProps {
  message: SmsMessageResponse;
}

export function SmsMessageCard({ message }: SmsMessageCardProps) {
  const timeAgo = formatDistanceToNow(new Date(message.receivedAt), {
    addSuffix: true,
    locale: fr,
  });

  return (
    <Card className="overflow-hidden" data-testid={`card-sms-${message.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
          <span className="font-mono text-sm font-medium text-muted-foreground" data-testid={`text-sender-${message.id}`}>
            {message.sender}
          </span>
          <span className="text-xs text-muted-foreground" data-testid={`text-time-${message.id}`}>
            {timeAgo}
          </span>
        </div>
        <p className="text-sm leading-relaxed" data-testid={`text-content-${message.id}`}>
          {message.content}
        </p>
      </CardContent>
    </Card>
  );
}
