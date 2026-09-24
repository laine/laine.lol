import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Lock, EyeOff, ServerOff, BookOpen, Shield } from "lucide-react";

interface SecurityInfoProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SecurityInfo: React.FC<SecurityInfoProps> = ({ trigger, open, onOpenChange }) => {
  const content = (
    <DialogContent className="sm:max-w-2xl bg-[#0F1014] border-[1px] border-[#20222a] rounded overflow-y-auto max-h-[90vh]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl">
          <span className="icon-tile h-7 w-7 shrink-0"><Shield className="h-4 w-4" /></span>
          Security Overview
        </DialogTitle>
        <DialogDescription className="text-white/50 text-base">
          How lainebin ensures your data remains private and unreadable by anyone but you or anyone you share the link with.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Lock className="h-4 w-4" />
            <h3>Client-Side Encryption</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            Every paste you create is encrypted using <span className="text-white font-mono">AES-GCM 256-bit</span> encryption
            directly in your browser <span className="italic">before</span> it is sent to our servers. Your plaintext
            data never leaves your device.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <EyeOff className="h-4 w-4" />
            <h3>Zero-Knowledge Architecture</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            The encryption key is generated locally and stored in the URL fragment (the part after the <span className="text-white font-mono">#</span>).
            By design, web browsers <span className="font-bold underline">never</span> send this part of the URL to the server.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <ServerOff className="h-4 w-4" />
            <h3>We Can't Read Your Data</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            Because we never receive your decryption key, it is technically impossible for us—or anyone with access to our
            servers—to read your pastes. We only store an opaque blob of encrypted data.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <Shield className="h-4 w-4 text-sky-300" />
            <h3 className="text-rainbow">Quantum-Resistant Encryption</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            For users who want protection against future quantum computing threats, we offer an optional
            <span className="text-white font-mono"> ML-KEM-1024 + AES-256-GCM</span> hybrid encryption mode.
            This uses the NIST-standardized post-quantum key encapsulation mechanism (FIPS 203) combined
            with classical symmetric encryption.
          </p>
          <p className="text-sm text-white/70 leading-relaxed">
            When enabled under advanced options, the encryption key in the URL becomes significantly
            longer (~4300 characters) because it contains the post-quantum decapsulation key. The
            trade-off is stronger future-proof security at the cost of longer, less shareable URLs.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <BookOpen className="h-4 w-4" />
            <h3>Open Privacy</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            This security model relies on standard Web Crypto APIs and browser behavior. You can verify this by checking
            the network tab in your browser's developer tools: you'll see that the key in the URL is never transmitted
            to <span className="text-white font-mono">rustybin.net</span>.
          </p>
        </section>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200/80 italic">
        <strong>Important:</strong> Since we don't have your key, we cannot recover your data if you lose the link.
        Please keep your URLs safe.
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

export default SecurityInfo;
