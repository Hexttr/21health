import * as React from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProgressProvider } from "@/contexts/ProgressContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { BalanceProvider } from "@/contexts/BalanceContext";
import { ChatContextProvider } from "@/contexts/ChatContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppFooter } from "@/components/AppFooter";

const Index = React.lazy(() => import("./pages/Index"));
const AIToolsHome = React.lazy(() => import("./pages/AIToolsHome"));
const ChatGPT = React.lazy(() => import("./pages/ChatGPT"));
const Claude = React.lazy(() => import("./pages/Claude"));
const Gemini = React.lazy(() => import("./pages/Gemini"));
const Groq = React.lazy(() => import("./pages/Groq"));
const EdgeTTS = React.lazy(() => import("./pages/EdgeTTS"));
const NanoBanana = React.lazy(() => import("./pages/NanoBanana"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const AdminLessons = React.lazy(() => import("./pages/admin/AdminLessons"));
const AdminMaterials = React.lazy(() => import("./pages/admin/AdminMaterials"));
const AdminStudents = React.lazy(() => import("./pages/admin/AdminStudents"));
const AdminCodes = React.lazy(() => import("./pages/admin/AdminCodes"));
const AdminWaitlist = React.lazy(() => import("./pages/admin/AdminWaitlist"));
const AdminBilling = React.lazy(() => import("./pages/admin/AdminBilling"));
const AdminTestimonials = React.lazy(() => import("./pages/admin/AdminTestimonials"));
const TopUp = React.lazy(() => import("./pages/TopUp"));
const CourseAccessPage = React.lazy(() => import("./pages/CourseAccessPage"));
const ReferralProgramPage = React.lazy(() => import("./pages/ReferralProgramPage"));
const SocialAuthCallbackPage = React.lazy(() => import("./pages/SocialAuthCallbackPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Data is always considered stale
      gcTime: 0, // Don't cache data in memory (previously cacheTime)
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: 'always', // Always refetch on component mount
      retry: 2,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
);

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const aiToolRoutes = ['/ai', '/chatgpt', '/claude', '/gemini', '/groq', '/edge-tts', '/nanobanana'];
  const isAIToolRoute = aiToolRoutes.includes(location.pathname);
  const hideFooter = isAIToolRoute;

  if (!isAuthenticated && !isLoading) {
    if (location.pathname !== "/") {
      return <Navigate to="/" replace />;
    }

    return (
      <div className="min-h-screen flex w-full flex-col">
        <main className="flex-1 min-h-0 overflow-auto">{children}</main>
        {!hideFooter && <AppFooter />}
      </div>
    );
  }

  return (
    <ChatContextProvider>
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 relative min-w-0 flex flex-col" style={{ backgroundColor: 'hsl(248deg 100% 94.56%)' }}>
          <div className={isAIToolRoute ? "flex-1 min-h-0" : "flex-1 min-h-0 overflow-auto"}>{children}</div>
          {!hideFooter && <AppFooter />}
        </main>
      </div>
    </SidebarProvider>
    </ChatContextProvider>
  );
};

// Protected admin route wrapper
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, isLoading, isAuthenticated } = useAuth();
  
  if (isLoading) {
    return null;
  }
  
  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ImpersonationProvider>
        <ProgressProvider>
          <BalanceProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <React.Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <AppLayout>
                        <Index />
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/auth/vkid/callback"
                    element={<SocialAuthCallbackPage />}
                  />
                  <Route
                    path="/ai"
                    element={
                      <AppLayout>
                        <AIToolsHome />
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/chatgpt"
                    element={
                      <AppLayout>
                        <ChatGPT />
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/gemini"
                    element={
                      <AppLayout>
                        <Gemini />
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/claude"
                    element={
                      <AppLayout>
                        <Claude />
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/groq"
                    element={
                      <AppLayout>
                        <Groq />
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/edge-tts"
                    element={
                      <AppLayout>
                        <EdgeTTS />
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/nanobanana"
                    element={
                      <AppLayout>
                        <NanoBanana />
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/topup"
                    element={
                      <AppLayout>
                        <TopUp />
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/course-access"
                    element={
                      <AppLayout>
                        <CourseAccessPage />
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/referral-program"
                    element={
                      <AppLayout>
                        <ReferralProgramPage />
                      </AppLayout>
                    }
                  />
                  {/* Admin routes */}
                  <Route path="/admin" element={<Navigate to="/admin/lessons" replace />} />
                  <Route
                    path="/admin/lessons"
                    element={
                      <AppLayout>
                        <AdminRoute>
                          <AdminLessons />
                        </AdminRoute>
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/admin/materials"
                    element={
                      <AppLayout>
                        <AdminRoute>
                          <AdminMaterials />
                        </AdminRoute>
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/admin/students"
                    element={
                      <AppLayout>
                        <AdminRoute>
                          <AdminStudents />
                        </AdminRoute>
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/admin/codes"
                    element={
                      <AppLayout>
                        <AdminRoute>
                          <AdminCodes />
                        </AdminRoute>
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/admin/waitlist"
                    element={
                      <AppLayout>
                        <AdminRoute>
                          <AdminWaitlist />
                        </AdminRoute>
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/admin/testimonials"
                    element={
                      <AppLayout>
                        <AdminRoute>
                          <AdminTestimonials />
                        </AdminRoute>
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/admin/billing"
                    element={
                      <AppLayout>
                        <AdminRoute>
                          <AdminBilling />
                        </AdminRoute>
                      </AppLayout>
                    }
                  />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </React.Suspense>
            </BrowserRouter>
          </TooltipProvider>
          </BalanceProvider>
        </ProgressProvider>
      </ImpersonationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
