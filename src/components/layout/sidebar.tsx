"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Ticket, 
  Settings, 
  LogOut, 
  Github, 
  ChevronRight,
  ShieldCheck,
  Calculator,
  ListTodo,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const db = useFirestore();

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc(profileRef);
  
  // Prioritize Firestore profile name, fallback to Auth name, then email prefix, then generic string
  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || "System User";

  const navItems = [
    { title: "Dashboard", icon: LayoutDashboard, url: "/dashboard" },
    { title: "Git Tickets", icon: Ticket, url: "/issues" },
    { title: "All Tickets", icon: Database, url: "/all-tickets" },
    { title: "Tasks", icon: ListTodo, url: "/tasks" },
    { title: "KPI Calculation", icon: Calculator, url: "/kpi" },
    { title: "GitHub Connect", icon: Github, url: "/connect" },
    { title: "Settings", icon: Settings, url: "/settings" },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="py-6 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-lg">
            <ShieldCheck className="h-6 w-6" />
          </div>
          {state === "expanded" && (
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-sidebar-foreground">SELISE-ITO</span>
              <span className="text-xs font-medium opacity-70 uppercase tracking-widest">Portal</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 px-4 mb-2">Main Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className={cn(
                      "flex items-center gap-3 px-4 py-6 transition-all",
                      pathname === item.url ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                      {pathname === item.url && <ChevronRight className="ml-auto h-4 w-4" />}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 bg-black/5 mt-auto">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 px-2">
            <Avatar className="h-10 w-10 border-2 border-sidebar-primary/20">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-foreground font-bold">
                {displayName[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            {state === "expanded" && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold truncate text-sidebar-foreground">
                  {displayName}
                </span>
                <span className="text-xs truncate opacity-70 text-sidebar-foreground/80">
                  {user?.email}
                </span>
              </div>
            )}
          </div>
          <Button 
            variant="ghost" 
            onClick={logout}
            className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-white/10 px-2"
          >
            <LogOut className="h-5 w-5" />
            {state === "expanded" && <span>Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
