import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { checkAuth } from "@/lib/admin";

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth().then((ok) => {
      if (!ok) {
        navigate("/admin/login", { replace: true });
      } else {
        setAuthenticated(true);
      }
      setChecking(false);
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#14151b]">
        <div className="flex items-center gap-2 text-xs uppercase text-white/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Checking authentication
        </div>
      </div>
    );
  }

  if (!authenticated) return null;

  return <>{children}</>;
}
