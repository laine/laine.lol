import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bell } from "lucide-react";

interface ChangelogEntry {
  date: string;
  version?: string;
  changes: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-03-26",
    version: "0.3.0",
    changes: [
      "Added drag & drop file import for pastes",
    ],
  },
  {
    date: "2026-03-20",
    version: "0.2.0",
    changes: [
      "Added quantum-resistant encryption mode using a hybrid ML-KEM-1024 + AES-256-GCM scheme",
      "Added full markdown support with preview, split view, and markdown toolbar",
    ],
  },
  {
    date: "2026-03-19",
    version: "0.1.0",
    changes: [
      "Added API & Encryption documentation",
      "Footer status indicator shows online, degraded, unhealthy, and offline states",
      "Added changelog dialog",
    ],
  },
];

// Bump this every time you add a new entry above
export const CHANGELOG_VERSION = "0.3.0";

const STORAGE_KEY = "rustybin-changelog-seen";

export function hasUnreadChangelog(): boolean {
  if (typeof window === "undefined") return false;
  const seen = localStorage.getItem(STORAGE_KEY);
  return seen !== CHANGELOG_VERSION;
}

export function markChangelogRead(): void {
  localStorage.setItem(STORAGE_KEY, CHANGELOG_VERSION);
}

interface ChangelogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Changelog: React.FC<ChangelogProps> = ({ trigger, open, onOpenChange }) => {
  const content = (
    <DialogContent className="max-w-sm sm:max-w-2xl bg-[#0F1014] border-[1px] border-[#20222a] rounded overflow-y-auto max-h-[90vh]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl">
          <span className="icon-tile h-7 w-7 shrink-0"><Bell className="h-4 w-4" /></span>
          Changelog
        </DialogTitle>
        <DialogDescription className="text-white/50 text-base">
          Recent updates and changes.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {CHANGELOG.map((entry, i) => (
          <section key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-primary">
                {entry.date}
              </span>
              {entry.version && (
                <span className="text-xs font-mono text-white/40 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                  v{entry.version}
                </span>
              )}
              {i === 0 && (
                <span className="text-[10px] uppercase tracking-wider font-bold text-green-500 bg-green-500/10 border border-green-500/20 rounded px-1.5 py-0.5">
                  latest
                </span>
              )}
            </div>
            <ul className="space-y-1">
              {entry.changes.map((change, j) => (
                <li key={j} className="text-sm text-white/70 leading-relaxed flex gap-2">
                  <span className="text-white/30 select-none">-</span>
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DialogContent>
  );

  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {content}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {content}
    </Dialog>
  );
};

export default Changelog;
