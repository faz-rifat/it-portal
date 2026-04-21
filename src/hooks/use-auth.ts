"use client"

import { useUser, useAuth as useFirebaseAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const { user, isUserLoading: loading } = useUser();
  const auth = useFirebaseAuth();
  const router = useRouter();

  const logout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  return { user, loading, logout };
}
