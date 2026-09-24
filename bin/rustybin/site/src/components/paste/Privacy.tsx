import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Eye } from "lucide-react";

interface PrivacyProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Privacy: React.FC<PrivacyProps> = ({ trigger, open, onOpenChange }) => {
  const content = (
    <DialogContent className="sm:max-w-2xl bg-[#0F1014] border-[1px] border-[#20222a] rounded overflow-y-auto max-h-[90vh]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl">
          <span className="icon-tile h-7 w-7 shrink-0"><Eye className="h-4 w-4" /></span>
          Privacy Policy
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-3">
        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <h3>Data we collect</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            lainebin does not require personally identifiable information to use our service. To avoid providing lainebin personal information, use Tor or a VPN, and follow basic OPSEC guidelines.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <h3>What we don't log</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            We log nothing whatsoever that can be connected to user's activity:
          </p>
          <ul className="list-disc text-sm text-white/70 leading-relaxed pl-6">
            <li>Traffic</li>
            <li>Browser fingerprints</li>
            <li>IP addresses</li>
            <li>DNS requests</li>
            <li>Unencrypted paste content</li>
          </ul>
          <p className="text-sm text-white/70 leading-relaxed">
            While we do use Cloudflare for their attack mitigation and DNS proxying - all optional logging features have been disabled. 
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <h3>What we log</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            While we don't log personally identifiable information, we do log the following information for our service to function:
          </p>
          <ul className="list-disc text-sm text-white/70 leading-relaxed pl-6">
            <li>Encrypted paste content</li>
            <li>Paste ID</li>
            <li>Paste programming language</li>
            <li>Paste creation timestamp</li>
            <li>Paste expiration timestamp</li>
            <li>Paste edit/delete key</li>
            <li>Paste burn after read</li>
          </ul>
        </section>
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

export default Privacy;
