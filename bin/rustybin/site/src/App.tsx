import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AdminAuthGuard } from "@/components/admin/AdminAuthGuard";

const Index = lazy(() => import("./pages/Index"));
const Workspace = lazy(() => import("./pages/Workspace"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

const queryClient = new QueryClient();

const App = () => {
  // Always use dark theme
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-screen bg-background text-muted-foreground">
                <div className="flex items-center gap-2 text-xs uppercase text-white/50">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Loading
                </div>
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/:id" element={<Index />} />
              <Route path="/w/new" element={<Workspace />} />
              <Route path="/w/:id" element={<Workspace />} />
              <Route path="/admin" element={<AdminAuthGuard><AdminDashboard /></AdminAuthGuard>} />
              <Route path="/admin/login" element={<AdminLogin />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
