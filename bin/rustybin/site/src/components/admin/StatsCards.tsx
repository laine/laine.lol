import { Card, CardContent } from "@/components/ui/card";
import { Database, Clock, Flame, HardDrive } from "lucide-react";

interface StatsCardsProps {
  totalPastes: number;
  pendingExpiration: number;
  burnAfterReadCount: number;
  totalSize: number;
  loading?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const cards = [
  {
    key: "total",
    label: "Total Pastes",
    icon: Database,
    getValue: (p: StatsCardsProps) => formatNumber(p.totalPastes),
  },
  {
    key: "expiring",
    label: "Pending Expiration",
    icon: Clock,
    getValue: (p: StatsCardsProps) => formatNumber(p.pendingExpiration),
  },
  {
    key: "burn",
    label: "Burn After Read",
    icon: Flame,
    getValue: (p: StatsCardsProps) => formatNumber(p.burnAfterReadCount),
  },
  {
    key: "size",
    label: "Total Storage",
    icon: HardDrive,
    getValue: (p: StatsCardsProps) => formatBytes(p.totalSize),
  },
];

export function StatsCards(props: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.key} className="border-border/50 bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                {props.loading ? (
                  <div className="h-8 w-20 bg-muted animate-pulse rounded mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-card-foreground mt-1">
                    {card.getValue(props)}
                  </p>
                )}
              </div>
              <card.icon className="w-8 h-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
