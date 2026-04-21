"use client"

import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  UserPlus, 
  Settings as SettingsIcon, 
  Shield, 
  Loader2,
  Trash2,
  Lock,
  Eraser,
  UserCheck,
  RefreshCcw
} from 'lucide-react';
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  useUser, 
  setDocumentNonBlocking, 
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
  useAuth,
  useDoc
} from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  // 1. ALL HOOKS AT THE TOP
  const { user: currentUser } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', displayName: '', password: '', role: 'user' });
  const [creating, setCreating] = useState(false);

  const currentUserRef = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return doc(db, 'users', currentUser.uid);
  }, [db, currentUser]);

  const { data: currentProfile, isLoading: isProfileLoading } = useDoc(currentUserRef);

  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: users, isLoading: isUsersLoading } = useCollection(usersQuery);

  // 2. LOGIC AFTER ALL HOOKS
  const isSuperAdmin = currentUser?.email === 'fazle.anonto@selisegroup.com';
  const isAdmin = (currentProfile?.role === 'admin') || isSuperAdmin;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast({ title: "Restricted", description: "Only administrators can provision new accounts.", variant: "destructive" });
      return;
    }

    setCreating(true);
    const secondaryAppName = `ProvisionApp-${Date.now()}`;
    let secondaryApp;
    
    try {
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: newUser.displayName });

      const userRef = doc(db, 'users', user.uid);
      setDocumentNonBlocking(userRef, {
        id: user.uid,
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role,
        needsPasswordChange: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast({
        title: "Staff Provisioned",
        description: `${newUser.displayName} has been added as ${newUser.role}.`,
      });

      setIsAddingUser(false);
      setNewUser({ email: '', displayName: '', password: '', role: 'user' });
    } catch (error: any) {
      toast({
        title: "Provisioning Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp).catch(() => {});
      }
      setCreating(false);
    }
  };

  const handleBulkCleanup = () => {
    if (!users || !isSuperAdmin) return;
    
    const others = users.filter(u => u.email !== 'fazle.anonto@selisegroup.com');
    if (others.length === 0) {
      toast({ title: "Clean", description: "No other user profiles found." });
      return;
    }

    if (window.confirm(`Are you sure you want to remove all ${others.length} other user directory profiles?`)) {
      others.forEach(u => {
        const userRef = doc(db, 'users', u.id);
        deleteDocumentNonBlocking(userRef);
      });
      toast({ title: "Cleanup Initiated", description: "Removing directory records." });
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      const userRef = doc(db, 'users', userId);
      updateDocumentNonBlocking(userRef, {
        needsPasswordChange: true,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Security Link Sent", description: `Reset link dispatched to ${email}.` });
    } catch (error: any) {
      toast({ title: "Action Restricted", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteUser = (userId: string, name: string) => {
    if (userId === currentUser?.uid) {
      toast({ title: "Action Denied", description: "You cannot remove your own account.", variant: "destructive" });
      return;
    }
    
    if (window.confirm(`Are you sure you want to remove ${name} from the portal?`)) {
      const userRef = doc(db, 'users', userId);
      deleteDocumentNonBlocking(userRef);
      toast({ title: "Access Revoked", description: `${name}'s directory record has been removed.` });
    }
  };

  // 3. EARLY RETURN FOR LOADING STATE (POST-HOOKS)
  if (isProfileLoading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" /> Control Center
          </h2>
          <p className="text-muted-foreground">Manage organization staff and portal access.</p>
        </div>

        <div className="flex gap-2">
          {isSuperAdmin && (
            <Button variant="outline" className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/5" onClick={handleBulkCleanup}>
              <Eraser className="h-4 w-4" /> Purge Directory
            </Button>
          )}
          
          {isAdmin && (
            <Dialog open={isAddingUser} onOpenChange={setIsAddingUser}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-lg hover:scale-105 transition-all">
                  <UserPlus className="h-4 w-4" /> Provision Staff
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add Portal User</DialogTitle>
                  <DialogDescription>Provision a new enterprise account.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddUser} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" placeholder="Full Name" value={newUser.displayName} onChange={(e) => setNewUser({...newUser, displayName: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Work Email</Label>
                    <Input id="email" type="email" placeholder="name@selisegroup.com" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Account Role</Label>
                    <Select value={newUser.role} onValueChange={(val) => setNewUser({...newUser, role: val})}>
                      <SelectTrigger id="role"><SelectValue placeholder="Select a role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Standard User</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tempPass">Temporary Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="tempPass" type="password" placeholder="••••••••" className="pl-10" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} required />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full h-11" disabled={creating}>
                      {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Complete Provisioning"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-xl flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Staff Directory
            </CardTitle>
            <CardDescription>
              {isAdmin ? "View and manage all employees with portal access." : "Directory of enterprise staff members."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Management</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isUsersLoading ? (
                  <TableRow><TableCell colSpan={isAdmin ? 5 : 4} className="h-24 text-center">Loading staff records...</TableCell></TableRow>
                ) : users && users.length > 0 ? (
                  users.map((u) => (
                    <TableRow key={u.id} className="group hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {u.displayName?.[0] || 'U'}
                          </div>
                          <span className="font-bold text-sm">{u.displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${u.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                          {u.role === 'admin' ? 'Administrator' : 'Staff'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {u.needsPasswordChange ? (
                          <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-full border">Setup Required</span>
                        ) : (
                          <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded-full border">Verified</span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => handleResetPassword(u.id, u.email)}>
                              <RefreshCcw className="h-3 w-3 mr-1" /> Reset
                            </Button>
                            {u.email !== 'fazle.anonto@selisegroup.com' && (
                              <Button variant="ghost" size="sm" className="h-7 text-[10px] text-destructive" onClick={() => handleDeleteUser(u.id, u.displayName)}>
                                <Trash2 className="h-3 w-3 mr-1" /> Remove
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={isAdmin ? 5 : 4} className="h-48 text-center opacity-50">No staff records found in the directory.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-primary/5 border-primary/10">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                <UserCheck className="h-4 w-4" /> Account Governance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Standard users can sync tickets and view dashboard analytics but cannot modify the staff directory. Administrators are responsible for provisioning and revoking access.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/5 border-secondary/10">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-secondary-foreground">
                <Lock className="h-4 w-4" /> Security Protocol
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Newly provisioned or reset users are flagged for a mandatory password change. This ensures every staff member controls their own permanent credentials from their first session.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
