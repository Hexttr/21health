import { Users, Play, LogOut, BookOpen, X, Shield, MessageCircle, Bot, GraduationCap, Library, Building2, ClipboardCheck, BarChart3, History } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProgress } from "@/contexts/ProgressContext";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
  SidebarSeparator,
  SidebarFooter,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const adminItems = [
  { title: "Уроки", url: "/admin/lessons", icon: BookOpen },
  { title: "Практ. материалы", url: "/admin/materials", icon: Play },
  { title: "Студенты", url: "/admin/students", icon: Users },
  { title: "Отзывы", url: "/admin/testimonials", icon: MessageCircle },
  { title: "AI-модели", url: "/admin/ai", icon: Bot },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const { isAdmin, isLmsStaff, canViewLmsAnalytics, user, signOut } = useAuth();
  const { getCompletedCount, getProgressPercentage } = useProgress();
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";

  const goHome = () => {
    navigate('/lms');
    setOpenMobile(false);
  };

  const completedCount = getCompletedCount();
  const progressPercentage = getProgressPercentage();

  const getMenuButtonClass = (isActive: boolean) => cn(
    "h-10 rounded-xl border px-2.5 transition-all duration-200",
    isActive
      ? "border-primary/15 bg-background/92 text-foreground shadow-xs"
      : "border-transparent text-foreground/90 hover:border-border/70 hover:bg-background/72 hover:text-foreground"
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      {/* ── Logo + collapse button ── */}
      <SidebarHeader className="p-4 pb-4">
        {!collapsed ? (
          <div className="flex items-center gap-2 w-full">
            <button type="button" onClick={goHome} className="flex items-center gap-3 group flex-1 min-w-0">
              <div className="w-11 h-11 rounded-xl gradient-hero flex items-center justify-center shadow-glow flex-shrink-0">
                <span className="text-white font-extrabold text-lg tracking-tight">21</span>
              </div>
              <span className="font-extrabold text-black text-2xl tracking-tight leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
                DAY
              </span>
            </button>
            <SidebarTrigger className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground rounded-lg" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <NavLink to="/lms" className="flex justify-center">
              <div className="w-11 h-11 rounded-xl gradient-hero flex items-center justify-center shadow-glow">
                <span className="text-white font-extrabold text-lg tracking-tight">21</span>
              </div>
            </NavLink>
            <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {!collapsed && (
          <div className="px-3 pb-3">
            <button type="button" onClick={goHome} className="w-full text-left p-3 rounded-xl bg-primary/8 border border-primary/15 hover:bg-primary/12 transition-colors cursor-pointer" style={{ background: 'hsl(263 52% 50% / 0.07)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground">Мой прогресс</span>
                <span className="text-xs font-bold text-primary">{progressPercentage}%</span>
              </div>
              <div className="h-1.5 bg-primary/15 rounded-full overflow-hidden">
                <div
                  className="h-full gradient-hero rounded-full transition-all duration-700"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 font-medium">{completedCount} из 21 уроков</p>
            </button>
          </div>
        )}

        <SidebarGroup className={collapsed ? "px-2 pb-2 pt-1" : "px-3 pb-2 pt-1"}>
            {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-0 pb-2">
              LMS
            </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === "/lms"} tooltip="Обучение" className={getMenuButtonClass(location.pathname === "/lms")}>
                    <NavLink to="/lms" className="flex items-center gap-3" onClick={() => setOpenMobile(false)}>
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors", location.pathname === "/lms" ? "border-primary/15 bg-primary/10 text-primary" : "border-border/40 bg-background/80 text-muted-foreground")}>
                        <GraduationCap className="h-4 w-4" />
                      </span>
                      <span className="font-medium">Обучение</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === "/course-legacy"} tooltip="Курс 21 день" className={getMenuButtonClass(location.pathname === "/course-legacy")}>
                    <NavLink to="/course-legacy" className="flex items-center gap-3" onClick={() => setOpenMobile(false)}>
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors", location.pathname === "/course-legacy" ? "border-primary/15 bg-primary/10 text-primary" : "border-border/40 bg-background/80 text-muted-foreground")}>
                        <History className="h-4 w-4" />
                      </span>
                      <span className="font-medium">Курс 21 день</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isLmsStaff && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.pathname === "/lms/admin/courses"} tooltip="Курсы LMS" className={getMenuButtonClass(location.pathname === "/lms/admin/courses")}>
                        <NavLink to="/lms/admin/courses" className="flex items-center gap-3" onClick={() => setOpenMobile(false)}>
                          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors", location.pathname === "/lms/admin/courses" ? "border-primary/15 bg-primary/10 text-primary" : "border-border/40 bg-background/80 text-muted-foreground")}>
                            <Library className="h-4 w-4" />
                          </span>
                          <span className="font-medium">Курсы LMS</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.pathname === "/lms/admin/org"} tooltip="Оргструктура" className={getMenuButtonClass(location.pathname === "/lms/admin/org")}>
                        <NavLink to="/lms/admin/org" className="flex items-center gap-3" onClick={() => setOpenMobile(false)}>
                          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors", location.pathname === "/lms/admin/org" ? "border-primary/15 bg-primary/10 text-primary" : "border-border/40 bg-background/80 text-muted-foreground")}>
                            <Building2 className="h-4 w-4" />
                          </span>
                          <span className="font-medium">Оргструктура</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.pathname === "/lms/admin/practice"} tooltip="Практика" className={getMenuButtonClass(location.pathname === "/lms/admin/practice")}>
                        <NavLink to="/lms/admin/practice" className="flex items-center gap-3" onClick={() => setOpenMobile(false)}>
                          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors", location.pathname === "/lms/admin/practice" ? "border-primary/15 bg-primary/10 text-primary" : "border-border/40 bg-background/80 text-muted-foreground")}>
                            <ClipboardCheck className="h-4 w-4" />
                          </span>
                          <span className="font-medium">Практика</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}
                {canViewLmsAnalytics && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname === "/lms/analytics"} tooltip="Аналитика" className={getMenuButtonClass(location.pathname === "/lms/analytics")}>
                      <NavLink to="/lms/analytics" className="flex items-center gap-3" onClick={() => setOpenMobile(false)}>
                        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors", location.pathname === "/lms/analytics" ? "border-primary/15 bg-primary/10 text-primary" : "border-border/40 bg-background/80 text-muted-foreground")}>
                          <BarChart3 className="h-4 w-4" />
                        </span>
                        <span className="font-medium">Аналитика LMS</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

        {/* ── Admin ── */}
        {isAdmin && (
          <>
            <SidebarSeparator className={collapsed ? "mx-2 my-0" : "mx-3 my-0"} />
            <SidebarGroup className={collapsed ? "px-2 pb-2 pt-3" : "px-3 pb-2 pt-3"}>
              {!collapsed && (
                <SidebarGroupLabel className="h-auto px-0 pb-3 pt-0">
                  <div className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background/65 px-3 py-3 shadow-xs">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground">Администрирование</div>
                      <div className="text-[10px] text-muted-foreground">Управление платформой</div>
                    </div>
                  </div>
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-1.5">
                  {adminItems.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.title} className={getMenuButtonClass(isActive)}>
                          <NavLink
                            to={item.url}
                            className="flex items-center gap-3"
                            onClick={() => setOpenMobile(false)}
                          >
                            <span className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
                              isActive
                                ? "border-primary/15 bg-primary/10 text-primary"
                                : "border-border/40 bg-background/80 text-muted-foreground"
                            )}>
                              <item.icon className="h-4.5 w-4.5" style={{ width: '18px', height: '18px' }} />
                            </span>
                            <span className="font-medium">{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* ── User footer: card + full-width Выйти ── */}
      {user && (
        <SidebarFooter className="px-3 pb-3 pt-2 space-y-2.5">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-background/65 px-2.5 py-2.5">
                <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center flex-shrink-0 shadow-glow">
                  <span className="text-xs font-bold text-white">
                    {(user.name?.charAt(0) || user.email?.charAt(0) || '?').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate leading-tight">
                    {user.name || 'Пользователь'}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{user.email}</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  await signOut();
                  setOpenMobile(false);
                  navigate('/', { replace: true });
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/25 bg-background/55 px-3 py-2.5 text-sm font-medium text-destructive/85 transition-colors hover:bg-destructive/8 hover:text-destructive"
              >
                <LogOut className="w-4 h-4" />
                Выйти
              </button>
            </>
          ) : (
            <button
              onClick={async () => {
                await signOut();
                setOpenMobile(false);
                navigate('/', { replace: true });
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive hover:text-white transition-colors flex-shrink-0 mx-auto"
              title="Выйти"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
