
"use client"

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const db = useFirestore();

  // Fetch profile from the global /users collection
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  useEffect(() => {
    if (loading) return;

    const isPublicPage = pathname === '/login' || pathname === '/register';
    
    // Redirect to login if not authenticated
    if (!user && !isPublicPage) {
      router.push('/login');
      return;
    }

    // Redirect to dashboard if logged in and accessing public pages
    if (user && isPublicPage) {
      router.push('/dashboard');
      return;
    }

    // Force password change if the profile document exists and has the flag
    if (user && profile && profile.needsPasswordChange === true && pathname !== '/change-password') {
      router.push('/change-password');
      return;
    }
  }, [user, loading, profile, router, pathname]);

  const isPublicPage = pathname === '/login' || pathname === '/register';

  // Global loading state
  if (loading || (user && isProfileLoading)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-8">
        <div className="w-full max-w-md space-y-4 text-center">
          <Skeleton className="h-12 w-12 mx-auto rounded-full" />
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  // If not authenticated and not on a public page, don't render children to avoid permission errors
  if (!user && !isPublicPage) {
    return null;
  }

  // Prevent any dashboard access if password change is required
  if (user && profile?.needsPasswordChange === true && pathname !== '/change-password') {
    return null;
  }

  return <>{children}</>;
}
