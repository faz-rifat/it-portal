
"use client"

import { useState } from 'react';
import { updatePassword, signOut } from 'firebase/auth';
import { useAuth as useFirebaseCoreAuth, useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const auth = useFirebaseCoreAuth();
  const db = useFirestore();
  const { toast } = useToast();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (!auth.currentUser) throw new Error("No authenticated user.");

      // Update auth password
      await updatePassword(auth.currentUser, password);

      // Update Firestore profile
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        needsPasswordChange: false,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "Security Updated",
        description: "Your password has been changed successfully.",
      });
      
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
      // If the error is "requires-recent-login", we should sign them out
      if (error.code === 'auth/requires-recent-login') {
        await signOut(auth);
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-xl ring-4 ring-amber-500/20">
            <ShieldAlert className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Security Required</h1>
          <p className="text-muted-foreground font-medium">Please update your temporary password</p>
        </div>

        <Card className="border-border/50 shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
            <CardDescription>Enter a strong, permanent password for your account.</CardDescription>
          </CardHeader>
          <form onSubmit={handleChangePassword}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11"
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <CheckCircle2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-11"
                    required 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button type="submit" className="w-full h-11 font-semibold text-base transition-all hover:scale-[1.02]" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Update Security & Enter Portal"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
