import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProgressProvider } from "@/contexts/ProgressContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Index from "./pages/Index";
import ChatGPT from "./pages/ChatGPT";
import Gemini from "./pages/Gemini";
import NanoBanana from "./pages/NanoBanana";
import NotFound from "./pages/NotFound";
import AdminLessons from "./pages/admin/AdminLessons";
import AdminMaterials from "./pages/admin/AdminMaterials";
import AdminStudents from "./pages/admin/AdminStudents";
import AdminCodes from "./pages/admin/AdminCodes";
import AdminWaitlist from "./pages/admin/AdminWaitlist";

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

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Hide sidebar completely for unauthenticated users
  if (!isAuthenticated && !isLoading) {
    return (
      <div className="min-h-screen flex w-full">
        <main className="flex-1 relative">
          {children}
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 relative">
          <SidebarTrigger className="fixed top-4 left-4 z-50 bg-card/80 backdrop-blur-sm border border-border/50 shadow-soft" />
          {children}
        </main>
      </div>
    </SidebarProvider>
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
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
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
                  path="/nanobanana"
                  element={
                    <AppLayout>
                      <NanoBanana />
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
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ProgressProvider>
      </ImpersonationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
