import { Github } from "lucide-react";

export const GITHUB_URL = "https://github.com/EternityX/rustybin/";

type GitHubLinkProps = {
  showLabel?: boolean;
};

export function GitHubLink({ showLabel = false }: GitHubLinkProps) {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View source on GitHub"
      className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white/30 hover:text-primary transition-colors"
    >
      <Github className="h-3.5 w-3.5" />
      {showLabel && <span className="hidden md:inline">GitHub</span>}
    </a>
  );
}
