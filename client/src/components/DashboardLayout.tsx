
import { useTranslation } from 'react-i18next';

import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
  SidebarGroup,
  SidebarGroupContent,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import type { LucideIcon } from "lucide-react";
import {
  Coins, Home, LogOut, MessageSquare, Settings as SettingsIcon, PanelLeft, Users
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';

type MenuItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  roles?: string[];
};

type MenuGroup = {
  id: string;
  items: MenuItem[];
};

// ─── Navigation items ───
// Add new pages here. Each item needs an icon, i18n label key, and path.
// Optional `roles` array restricts visibility (omit for all users).
const menuGroups: MenuGroup[] = [
  {
    id: "general",
    items: [
      { icon: Home, label: "dashboard", path: "/dashboard" },
      { icon: MessageSquare, label: "chat_title", path: "/chat-example" },
    ]
  },
  {
    id: "admin",
    items: [
      { icon: Users, label: "user_management", path: "/admin/users", roles: ["admin"] },
    ]
  },
  {
    id: "account",
    items: [
      { icon: Coins, label: "billing_credits", path: "/billing", roles: ["admin"] },
    ]
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    if (!loading && !user && typeof window !== "undefined") {
      window.location.href = getLoginUrl();
    }
  }, [loading, user]);

  if (loading || !user) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const userRole = user?.role || "viewer";
  
  // Mapping old roles to new structure for compatibility if any old data remains
  const effectiveRole = (userRole as string) === 'creator' ? 'editor' : (userRole as string) === 'consumer' ? 'viewer' : userRole;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const handleLogout = async () => {
    await logout();
    window.location.href = getLoginUrl();
  };

  const roleLabel = 
    effectiveRole === "editor" ? "Editor" : 
    effectiveRole === "admin" ? "Admin" : "Viewer";
    
  const roleColor = (effectiveRole === "editor" || effectiveRole === "admin") ? "default" : "secondary";

  const activeMenuItem = menuGroups.flatMap(g => g.items).find(item =>
    location === item.path || (item.path !== "/" && location.startsWith(item.path))
  );

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label={t("layout.toggleNavigation")}
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/70" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-bold tracking-tight text-sidebar-foreground text-lg">
                    {t('app_name')}
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-2">
            {menuGroups.map((group, groupIndex) => {
              // Filter items based on role
              const filteredItems = group.items.filter(item => {
                if (!item.roles) return true;
                return item.roles.includes(effectiveRole) || item.roles.includes(userRole);
              });

              if (filteredItems.length === 0) return null;

              return (
                <div key={group.id}>
                  {groupIndex > 0 && (
                     <div className="px-2 py-1">
                        <SidebarSeparator className="bg-sidebar-border/50" />
                     </div>
                  )}
                  <SidebarGroup className="py-1">
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {filteredItems.map(item => {
                          const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                          return (
                            <SidebarMenuItem key={item.path}>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive}
                                tooltip={t(item.label)}
                                className="h-10 transition-all font-normal"
                              >
                                <Link href={item.path}>
                                  <item.icon className={`h-4 w-4 ${isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70"}`} />
                                  <span>{t(item.label)}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </div>
              );
            })}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-sidebar-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none">
                  <Avatar className="h-9 w-9 border border-sidebar-border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-sidebar-accent text-sidebar-foreground">
                      {user?.name?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate leading-none text-sidebar-foreground">
                        {user?.name || "-"}
                      </p>
                      <Badge variant={roleColor} className="text-[10px] px-1.5 py-0 h-4">
                        {roleLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-sidebar-foreground/50 truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                
                <DropdownMenuItem onClick={() => setLocation("/settings")} className="cursor-pointer">
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  <span>{t("settings")}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-3 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="font-semibold text-foreground">
                {activeMenuItem?.label ? t(activeMenuItem.label) : t('app_name')}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
