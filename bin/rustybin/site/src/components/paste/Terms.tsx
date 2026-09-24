import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";

interface TermsProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Terms: React.FC<TermsProps> = ({ trigger, open, onOpenChange }) => {
  const content = (
    <DialogContent className="sm:max-w-2xl bg-[#0F1014] border-[1px] border-[#20222a] rounded overflow-y-auto max-h-[90vh]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl">
          <span className="icon-tile h-7 w-7 shrink-0"><FileText className="h-4 w-4" /></span>
          Terms of Service
        </DialogTitle>
        <DialogDescription className="text-white/50 text-base">
          By using lainebin (the "Service"), you agree to the following terms:
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <h3>1. Acceptable Use</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            You are solely responsible for all content you upload, download, or share through the Service. You agree not to use the Service for any illegal or harmful purposes.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <h3>2. Prohibited Content</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            The following types of content are strictly prohibited:
          </p>
          <ul className="list-disc text-sm text-white/70 leading-relaxed pl-6">
            <li><span className="font-bold">Child Exploitation:</span>{" "}Links to videos, images, or audio depicting abuse or inappropriate touching of minors. Any such content will be removed and reported to the National Center for Missing and Exploited Children.</li>
            <li><span className="font-bold">Terrorism:</span>{" "}Text or links to content that promotes or glorifies acts of terrorism.</li>
            <li><span className="font-bold">Extreme Gore:</span>{" "}Links to graphic and shocking content depicting severe harm to humans or animals.</li>
            <li><span className="font-bold">Doxing:</span>{" "}Posting private information about an individual or organization with malicious intent.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <h3>3. Content Removal</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            We reserve the right to remove any content that violates these terms, or that we deem harmful or inappropriate.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <h3>4. Reporting Abuse</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            If you believe that a paste violates these terms, please report it to <a href="mailto:admin@deadcell.software" className="text-primary hover:underline">admin@deadcell.software</a>.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <h3>5. Disclaimer</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            The Service is provided "as is" without any warranties. We are not liable for any damages arising from your use of the Service.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <h3>6. Changes</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            We may update these terms at any time. Your continued use of the Service constitutes acceptance of any changes.
          </p>
        </section>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200/80 italic">
        By using the Service, you acknowledge that you have read and understood these terms.
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

export default Terms;
