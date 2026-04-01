import { ClipboardPaste, CalendarClock, Lock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Link } from "wouter";

const bots = [
  {
    name: "Quick Paste WO",
    description: "Paste work order data and create instantly",
    icon: ClipboardPaste,
    color: "text-blue-500/40",
    bg: "bg-blue-500/5",
    active: false,
    href: "/bots/quick-paste",
  },
  {
    name: "Appointment Scheduler",
    description: "Schedule medical or EID appointments with a guided chat assistant",
    icon: CalendarClock,
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
    active: true,
    href: "/bots/scheduler",
  },
];

export default function BotsHub() {
  return (
    <AppLayout>
      <PageHeader
        title="Bots"
        subtitle="Automate your workflows"
      />
      <div className="p-4 lg:p-8 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bots.map((bot) => {
            const card = (
              <Card
                key={bot.name}
                className={bot.active ? "hover-elevate cursor-pointer h-full" : "opacity-60 cursor-default h-full"}
                data-testid={`card-bot-${bot.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-xl ${bot.bg} flex items-center justify-center shrink-0`}>
                      <bot.icon className={`h-6 w-6 ${bot.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground" data-testid={`text-bot-name-${bot.name.toLowerCase().replace(/\s+/g, "-")}`}>
                          {bot.name}
                        </h3>
                        {!bot.active ? (
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 gap-1">
                            <Lock className="h-3 w-3" />
                            Coming Soon
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] px-2 py-0.5 bg-emerald-500 text-white border-0">
                            Live
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {bot.description}
                      </p>
                    </div>
                    {bot.active && (
                      <ChevronRight className="h-5 w-5 text-muted-foreground/50 mt-0.5 shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );

            return bot.active ? (
              <Link key={bot.name} href={bot.href}>
                {card}
              </Link>
            ) : (
              <div key={bot.name}>{card}</div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
