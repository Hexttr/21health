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
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppFooter } from "@/components/AppFooter";

const Index = React.lazy(() => import("./pages/Index"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const AdminLessons = React.lazy(() => import("./pages/admin/AdminLessons"));
const AdminMaterials = React.lazy(() => import("./pages/admin/AdminMaterials"));
const AdminStudents = React.lazy(() => import("./pages/admin/AdminStudents"));
const AdminBilling = React.lazy(() => import("./pages/admin/AdminBilling"));
const AdminTestimonials = React.lazy(() => import("./pages/admin/AdminTestimonials"));
const CourseLegacy = React.lazy(() => import("./pages/CourseLegacy"));
const LmsHome = React.lazy(() => import("./pages/lms/LmsHome"));
const LmsEnrollment = React.lazy(() => import("./pages/lms/LmsEnrollment"));
const LmsAdminCourses = React.lazy(() => import("./pages/lms/LmsAdminCourses"));
const LmsAdminOrg = React.lazy(() => import("./pages/lms/LmsAdminOrg"));
const LmsPracticeReview = React.lazy(() => import("./pages/lms/LmsPracticeReview"));
const LmsAnalytics = React.lazy(() => import("./pages/lms/LmsAnalytics"));

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

  if (!isAuthenticated && !isLoading) {
    if (location.pathname !== "/") {
      return <Navigate to="/" replace />;
    }

    return (
      <div className="min-h-screen flex w-full flex-col">
        <main className="flex-1 min-h-0 overflow-auto">{children}</main>
        <AppFooter />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 relative min-w-0 flex flex-col" style={{ backgroundColor: 'hsl(248deg 100% 94.56%)' }}>
          <div className="flex-1 min-h-0 overflow-auto">{children}</div>
          <AppFooter />
        </main>
      </div>
    </SidebarProvider>
  );
};

// Protected admin route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <RouteFallback />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const LmsStaffRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, isLmsStaff } = useAuth();
  if (isLoading) {
    return <RouteFallback />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  if (!isLmsStaff) {
    return <Navigate to="/lms" replace />;
  }
  return <>{children}</>;
};

const LmsAnalyticsRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, canViewLmsAnalytics } = useAuth();
  if (isLoading) {
    return <RouteFallback />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  if (!canViewLmsAnalytics) {
    return <Navigate to="/lms" replace />;
  }
  return <>{children}</>;
};

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
                    path="/lms"
                    element={
                      <AppLayout>
                        <ProtectedRoute>
                          <LmsHome />
                        </ProtectedRoute>
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/lms/enrollment/:enrollmentId"
                    element={
                      <AppLayout>
                        <ProtectedRoute>
                          <LmsEnrollment />
                        </ProtectedRoute>
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/course-legacy"
                    element={
                      <AppLayout>
                        <ProtectedRoute>
                          <CourseLegacy />
                        </ProtectedRoute>
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/lms/admin/courses"
                    element={
                      <AppLayout>
                        <LmsStaffRoute>
                          <LmsAdminCourses />
                        </LmsStaffRoute>
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/lms/admin/org"
                    element={
                      <AppLayout>
                        <LmsStaffRoute>
                          <LmsAdminOrg />
                        </LmsStaffRoute>
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/lms/admin/practice"
                    element={
                      <AppLayout>
                        <LmsStaffRoute>
                          <LmsPracticeReview />
                        </LmsStaffRoute>
                      </AppLayout>
                    }
                  />
                  <Route
                    path="/lms/analytics"
                    element={
                      <AppLayout>
                        <LmsAnalyticsRoute>
                          <LmsAnalytics />
                        </LmsAnalyticsRoute>
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
                    path="/admin/ai"
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
        </ProgressProvider>
      </ImpersonationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
