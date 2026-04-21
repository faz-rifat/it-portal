"use client"

import { AppSidebar } from '@/components/layout/sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut, User, Settings as SettingsIcon, Bell } from 'lucide-react';

interface PortalShellProps {
  children: React.ReactNode;
}

export function PortalShell({ children }: PortalShellProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const db = useFirestore();

  // Fetch Firestore profile to get the most accurate name
  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc(profileRef);

  // Prioritize Firestore profile name, fallback to Auth name, then email prefix, then generic string
  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || "System User";

  const getPageTitle = () => {
    if (pathname.startsWith('/kpi')) return 'KPI Calculation';
    if (pathname.startsWith('/all-tickets')) return 'Global Archive';
    switch (pathname) {
      case '/dashboard': return 'Dashboard Overview';
      case '/issues': return 'Git Tickets';
      case '/tasks': return 'Task Management';
      case '/connect': return 'GitHub Connection';
      case '/settings': return 'Account Settings';
      default: return 'SELISE-ITO Portal';
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-card/80 backdrop-blur-md px-4 md:px-6 sticky top-0 z-30 transition-all">
          <div className="flex items-center gap-2 md:gap-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="hidden md:block h-4" />
            <div className="flex flex-col">
              <h1 className="text-sm md:text-base font-bold tracking-tight text-foreground truncate">
                {getPageTitle()}
              </h1>
              <p className="hidden md:block text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                SELISE Enterprise
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" className="hidden md:flex text-muted-foreground hover:text-primary">
              <Bell className="h-5 w-5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 md:h-10 md:w-auto md:gap-3 md:px-2 rounded-full md:rounded-lg">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={user?.photoURL || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {displayName[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start text-left">
                    <span className="text-xs font-bold truncate max-w-[150px]">
                      {displayName}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                      {user?.email}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-2">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" /> Profile Details
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <SettingsIcon className="mr-2 h-4 w-4" /> Preferences
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:bg-destructive/10 cursor-pointer" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
