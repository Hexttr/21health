import { Users, Ticket, Play, ClipboardList, LogOut, BookOpen, X, Trash2, DollarSign } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useChatContext } from "@/contexts/ChatContext";
import { useProgress } from "@/contexts/ProgressContext";
import { BalanceWidget } from "@/components/BalanceWidget";
import { aiTools, getAIToolBadge, type AIToolConfig } from "@/lib/ai-tools";
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
  { title: "Пригл. коды", url: "/admin/codes", icon: Ticket },
  { title: "Лист ожидания", url: "/admin/waitlist", icon: ClipboardList },
  { title: "Биллинг и модели", url: "/admin/billing", icon: DollarSign },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const { isAdmin, user, signOut } = useAuth();
  const chatContext = useChatContext();
  const { getCompletedCount, getProgressPercentage } = useProgress();
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";

  const goHome = () => {
    const target = user?.role === 'ai_user' ? '/chatgpt' : '/';
    navigate(target);
    setOpenMobile(false);
  };

  const completedCount = getCompletedCount();
  const progressPercentage = getProgressPercentage();
  const freeToolItems = aiTools.filter((item) => item.access === 'free');
  const paidToolItems = aiTools.filter((item) => item.access === 'paid');

  const renderToolIcon = (item: AIToolConfig) => {
    if (item.icon) {
      return (
        <span className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0 overflow-hidden bg-secondary/50">
          <img src={item.icon} alt="" className="w-full h-full object-contain" />
        </span>
      );
    }

    return (
      <span className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0 overflow-hidden bg-secondary/50 text-[13px]">
        {item.iconEmoji || '•'}
      </span>
    );
  };

  const renderToolMenu = (items: AIToolConfig[]) => (
    <SidebarMenu>
      {items.map((item) => {
        const isActive = location.pathname === item.url;
        const showTrash = !collapsed && isActive && item.hasChat && item.modelPath;

        return (
          <SidebarMenuItem key={item.title}>
            <div className="flex items-center gap-1 w-full group/item">
              <SidebarMenuButton asChild isActive={isActive} tooltip={item.title} className="flex-1">
                <NavLink to={item.url} className="flex items-center gap-3">
                  {renderToolIcon(item)}
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-medium truncate">{item.title}</span>
                    {!collapsed && (
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getAIToolBadge(item.access)}`}>
                        {item.access === 'free' ? 'free' : 'paid'}
                      </span>
                    )}
                  </div>
                </NavLink>
              </SidebarMenuButton>
              {showTrash && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    chatContext?.clearChat(item.modelPath!);
                  }}
                  className="opacity-60 hover:opacity-100 hover:text-destructive p-1.5 rounded-md transition-colors"
                  title="Очистить чат"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      {/* ── Logo + collapse button ── */}
      <SidebarHeader className="p-4 pb-3">
        {!collapsed ? (
          <div className="flex items-center gap-2 w-full">
            <button onClick={goHome} className="flex items-center gap-3 group flex-1 min-w-0">
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
            <NavLink to={user?.role === 'ai_user' ? '/chatgpt' : '/'} className="flex justify-center">
              <div className="w-11 h-11 rounded-xl gradient-hero flex items-center justify-center shadow-glow">
                <span className="text-white font-extrabold text-lg tracking-tight">21</span>
              </div>
            </NavLink>
            <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* ── Progress pill (expanded) — скрыт для ai_user ── */}
        {!collapsed && user?.role !== 'ai_user' && (
          <div className="px-3 pb-2">
            <button onClick={goHome} className="w-full text-left p-3 rounded-xl bg-primary/8 border border-primary/15 hover:bg-primary/12 transition-colors cursor-pointer" style={{ background: 'hsl(263 52% 50% / 0.07)' }}>
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

        {/* ── Balance widget ── */}
        {!collapsed && (
          <div className="px-3 pb-2">
            <BalanceWidget />
          </div>
        )}

        {/* ── AI Tools ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Инструменты ИИ
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {!collapsed && freeToolItems.length > 0 && (
              <div className="mb-3">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600/80">
                  Бесплатно
                </p>
                {renderToolMenu(freeToolItems)}
              </div>
            )}
            {!collapsed && paidToolItems.length > 0 && (
              <div>
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
                  Платно
                </p>
                {renderToolMenu(paidToolItems)}
              </div>
            )}
            {collapsed && renderToolMenu([...freeToolItems, ...paidToolItems])}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Admin ── */}
        {isAdmin && (
          <>
            <SidebarSeparator className="my-2" />
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Администрирование
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                          <NavLink to={item.url} className="flex items-center gap-3">
                            <item.icon className="h-4.5 w-4.5" style={{ width: '18px', height: '18px' }} />
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
        <SidebarFooter className="p-3 space-y-2">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl bg-secondary/60 border border-border/50">
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
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive font-medium text-sm hover:bg-destructive hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Выйти
              </button>
            </>
          ) : (
            <button
              onClick={() => signOut()}
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
