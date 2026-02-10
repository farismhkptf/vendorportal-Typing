import { Link } from "wouter";
import { ClipboardPaste, CalendarClock, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";

const bots = [
  {
    name: "Quick Paste WO",
    description: "Paste work order data and create instantly",
    href: "/bots/quick-paste",
    icon: ClipboardPaste,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    name: "Appointment Scheduler",
    description: "Schedule medical or EID appointments step by step",
    href: "/bots/scheduler",
    icon: CalendarClock,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
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
          {bots.map((bot) => (
            <Link key={bot.href} href={bot.href}>
              <Card
                className="cursor-pointer hover-elevate transition-all duration-200 h-full"
                data-testid={`card-bot-${bot.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-xl ${bot.bg} flex items-center justify-center shrink-0`}>
                      <bot.icon className={`h-6 w-6 ${bot.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-foreground" data-testid={`text-bot-name-${bot.name.toLowerCase().replace(/\s+/g, "-")}`}>
                        {bot.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {bot.description}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground/50 shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
