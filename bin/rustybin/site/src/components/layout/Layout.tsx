import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  Save,
  Loader2,
  Trash2,
  ShieldCheck,
  FileText,
  Eye,
  Code,
  Bell,
} from "lucide-react";
import { GitHubLink } from "@/components/layout/GitHubLink";
import SecurityInfo from "@/components/paste/SecurityInfo";
import { languageOptions, getLanguageLabel } from "@/utils/language-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Terms from "../paste/Terms";
import Privacy from "../paste/Privacy";
import ApiEncryption from "../paste/ApiEncryption";
import Changelog, {
  hasUnreadChangelog,
  markChangelogRead,
} from "../paste/Changelog";

type MainLayoutProps = {
  children: React.ReactNode;
  language?: string;
  readOnly?: boolean;
  showLanguageSelector?: boolean;
  setLanguage?: (language: string) => void;
  clearContent?: () => void;
  saveContent?: () => void;
  isLoading?: boolean;
  isDetectingLanguage?: boolean;
  canSave?: boolean;
  canDelete?: boolean;
  onDelete?: () => void;
  byteCount?: number;
  maxBytes?: number;
  isOverLimit?: boolean;
  showByteCounter?: boolean;
  headerExtra?: React.ReactNode;
};

const MainLayout = ({
  children,
  language = "typescript",
  readOnly = false,
  showLanguageSelector = false,
  setLanguage = () => {},
  clearContent = () => {},
  saveContent = () => {},
  isLoading = false,
  isDetectingLanguage = false,
  canSave = true,
  canDelete = false,
  onDelete = () => {},
  byteCount = 0,
  maxBytes = 125000,
  isOverLimit = false,
  showByteCounter = false,
  headerExtra,
}: MainLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [securityOpen, setSecurityOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [apiEncryptionOpen, setApiEncryptionOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [changelogUnread, setChangelogUnread] = useState(() =>
    hasUnreadChangelog(),
  );

  // Check if API is available
  const [isApiAvailable, setIsApiAvailable] = useState(true);
  const [apiHealth, setApiHealth] = useState("checking");
  useEffect(() => {
    const checkApi = async () => {
      try {
        const apiOrigin = `${import.meta.env.VITE_API_URL}`;
        const response = await fetch(`${apiOrigin}/health`);

        const data = await response.json();

        setIsApiAvailable(true);
        setApiHealth(data.status);
      } catch (error) {
        setIsApiAvailable(false);
        setApiHealth("offline");
      }
    };
    checkApi();
  }, []);

  const navItems = [
    {
      path: "/",
      icon: <Plus className="h-4 w-4" />,
      label: "new",
      shortcut: "ctrl+o",
      className: "text-nowrap text-white disabled:!text-white/50",
      onClick: () => {
        if (!isLoading) {
          clearContent();
          navigate("/");
        }
      },
      disabled: isLoading || !location.hash || location.hash === "#",
    },
    {
      path: "/",
      icon: isLoading && <Loader2 className="h-4 w-4 animate-spin" />,
      label: isLoading ? "saving..." : "save",
      shortcut: "ctrl+s",
      className: canSave ? "!text-green-400 hover:!text-green-500" : "hidden",
      onClick: () => !isLoading && saveContent(),
      disabled: isLoading || !canSave,
    },
    {
      path: "/",
      icon: <Trash2 className="h-4 w-4" />,
      label: "delete",
      className: canDelete
        ? "border-l border-white/10 ml-[2px] rounded !text-red-400 hover:!text-red-500"
        : "hidden",
      onClick: () => !isLoading && onDelete(),
      disabled: isLoading || !canDelete,
    },
  ];

  return (
    // Title bar
    <div className="flex h-screen overflow-hidden flex-col">
      <header className="sticky top-0 z-50 border-b bg-[#0d0e11]">
        <div className="flex min-h-[35px] flex-col sm:flex-row sm:items-center sm:justify-between px-2 -mt-1 py-1 sm:py-0 sm:mt-0 gap-y-1">
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <Link
              to="/"
              className="items-center gap-1 text-lg font-semibold transition-opacity hidden md:flex"
            >
              <span className="group text-[12px] uppercase tracking-wider font-bold transition-colors">
                <span className="brand-gradient">laine</span>
                <span className="text-[12px] uppercase tracking-wider font-bold text-white group-hover:text-white/50 transition-colors">
                  bin
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              {isLoading && (
                <div className="flex items-center text-xs text-muted-foreground bg-[#0F1014] border-[1px] border-[#20222a] px-2 py-0.5 mt-0.5">
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5 text-primary" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-white/70">
                    saving...
                  </span>
                </div>
              )}
              {isDetectingLanguage && !isLoading && (
                <div className="flex items-center text-xs text-muted-foreground bg-[#0F1014] border-[1px] border-[#20222a] px-2 py-0.5 mt-0.5">
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5 text-primary" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-white/70">
                    determining language...
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
            {showLanguageSelector && (
              <div className="flex items-center gap-1">
                <Select
                  value={language}
                  onValueChange={setLanguage}
                  disabled={readOnly || isLoading}
                >
                  <SelectTrigger className="h-[21px] w-[120px] text-[10px] uppercase tracking-wider font-bold bg-[#0F1014]/0 border-[#20222a] rounded mr-1">
                    <SelectValue>{getLanguageLabel(language)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-[#0F1014] border-[#20222a] rounded max-h-[400px]">
                    {languageOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-[10px] uppercase tracking-wider font-bold"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <nav className="flex items-center gap-1.5">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={`flex items-center gap-2 rounded text-sm font-medium transition-colors
                    ${
                      location.pathname === item.path
                        ? "hover:text-primary text-primary-foreground"
                        : "hover:text-primary"
                    } ${item.className} ${
                      item.disabled ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                >
                  {item.shortcut && (
                    <span className="text-xs text-foreground bg-[#0F1014]/0 border rounded border-[#20222a] px-1 py-[2px] font-mono hidden md:inline -mr-2">
                      {item.shortcut}
                    </span>
                  )}
                  <span className="inline px-[8px] py-2 text-[10px] uppercase tracking-wider font-bold hover:text-primary transition-colors">
                    {item.label}
                  </span>
                </button>
              ))}
            </nav>
            {headerExtra}
          </div>
        </div>
      </header>

      <main className="flex-1 animate-fade-in flex flex-col min-h-0">
        {children}
      </main>

      <footer className="sticky bottom-0 z-50 border-t border-white/10 bg-[#0d0e11]">
        <div className="flex min-h-[30px] items-center  py-1">
          {(() => {
            const isChecking = apiHealth === "checking";
            const dotColor = isChecking
              ? "bg-white/30"
              : !isApiAvailable
                ? "bg-red-500"
                : apiHealth === "ok"
                  ? "bg-green-500"
                  : apiHealth === "degraded"
                    ? "bg-amber-500"
                    : "bg-orange-500";
            const textColor = isChecking
              ? "text-white/30"
              : !isApiAvailable
                ? "text-red-500"
                : apiHealth === "ok"
                  ? "text-green-500"
                  : apiHealth === "degraded"
                    ? "text-amber-500"
                    : "text-orange-500";
            const label = isChecking
              ? "checking"
              : !isApiAvailable
                ? "offline"
                : apiHealth === "ok"
                  ? "online"
                  : apiHealth === "degraded"
                    ? "degraded"
                    : "unhealthy";
            return (
              <div
                className={`items-center gap-1.5 pl-2 pr-3 py-1 text-[10px] uppercase tracking-wider font-bold ${textColor} hidden sm:flex border-r mr-1.5 border-white/10`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${dotColor} relative`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-ping`}
                  ></div>
                </div>
                <span className="inline">{label}</span>
              </div>
            );
          })()}

          <SecurityInfo
            open={securityOpen}
            onOpenChange={setSecurityOpen}
            trigger={
              <button className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white/30 hover:text-primary transition-colors">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Security Overview</span>
              </button>
            }
          />

          <Terms
            open={termsOpen}
            onOpenChange={setTermsOpen}
            trigger={
              <button className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white/30 hover:text-primary transition-colors">
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Terms of Service</span>
              </button>
            }
          />

          <Privacy
            open={privacyOpen}
            onOpenChange={setPrivacyOpen}
            trigger={
              <button className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white/30 hover:text-primary transition-colors">
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Privacy Policy</span>
              </button>
            }
          />

          <ApiEncryption
            open={apiEncryptionOpen}
            onOpenChange={setApiEncryptionOpen}
            trigger={
              <button className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white/30 hover:text-primary transition-colors">
                <Code className="h-3.5 w-3.5" />
                <span className="hidden md:inline">API</span>
              </button>
            }
          />

          <Changelog
            open={changelogOpen}
            onOpenChange={(open) => {
              setChangelogOpen(open);
              if (open) {
                markChangelogRead();
                setChangelogUnread(false);
              }
            }}
            trigger={
              <button className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white/30 hover:text-primary transition-colors relative">
                <span className="relative">
                  <Bell className="h-3.5 w-3.5" />
                  {changelogUnread && (
                    <span className="absolute -top-1 -right-1">
                      <span className="block w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                    </span>
                  )}
                </span>
                <span className="hidden md:inline">Changelog</span>
              </button>
            }
          />

          <GitHubLink showLabel />

          {showByteCounter && (
            <div className="items-center ml-auto gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-white/30 hidden sm:flex">
              <span
                className={
                  isOverLimit ? "text-red-500 font-semibold" : "text-white/30"
                }
              >
                {isOverLimit
                  ? `${Math.abs((byteCount || 0) - (maxBytes || 0))} bytes over limit!`
                  : `${byteCount || 0}/${maxBytes || 0} bytes`}
              </span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
