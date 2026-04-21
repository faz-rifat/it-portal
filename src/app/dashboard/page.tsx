"use client"

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Users,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { format, isToday, subDays, startOfDay, isWithinInterval, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const TEAM_MEMBERS = [
  "faz-rifat",
  "emon-selise",
  "SaimunSelise",
  "Amir-Ahammed-SG",
  "zzsabit",
  "fahim-selise"
];

export default function DashboardPage() {
  // 1. ALL HOOKS AT THE TOP - MUST BE STABLE
  const { user } = useUser();
  const db = useFirestore();

  const issuesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'enterprise-projects', 'github-project-181', 'issues'),
      orderBy('githubCreatedAt', 'desc')
    );
  }, [db, user]);

  const { data: rawIssues, isLoading, error } = useCollection(issuesQuery);

  const stats = useMemo(() => {
    // Return empty state instead of early returning inside component logic
    if (!rawIssues) {
      return { total: 0, active: 0, resolvedToday: 0, avgResponse: "0.0", chartData: [], contributors: [] };
    }
    
    const teamLower = TEAM_MEMBERS.map(m => m.toLowerCase());
    const filteredIssues = rawIssues.filter(issue => {
      const isTeamAuthor = teamLower.includes(issue.reporterUsername?.toLowerCase() || "");
      const isL2Status = issue.customStatus === 'Dhaka Team (L2)';
      const isObservingStatus = issue.customStatus === 'Under Observation (L2)';
      const isL2Label = issue.labelNames?.some((l: string) => l.toUpperCase() === 'L2') || false;
      return isTeamAuthor || isL2Status || isObservingStatus || isL2Label;
    });

    if (filteredIssues.length === 0) {
      return { total: 0, active: 0, resolvedToday: 0, avgResponse: "0.0", chartData: [], contributors: [] };
    }

    const total = filteredIssues.length;
    const active = filteredIssues.filter(i => (i.status || "").toUpperCase() === 'OPEN').length;
    
    const resolvedToday = filteredIssues.filter(i => {
      const status = (i.status || "").toUpperCase();
      if (status !== 'CLOSED') return false;
      const date = i.dateResolved ? new Date(i.dateResolved) : (i.githubUpdatedAt ? new Date(i.githubUpdatedAt) : null);
      return date && !isNaN(date.getTime()) && isToday(date);
    }).length;

    // ART Logic: Σ(ResponseTime) / Total Scoped Tickets
    const totalResponseMinutes = filteredIssues.reduce((acc, i) => {
      const val = parseFloat(i.responseTimeMinutes);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    
    const avgResponseVal = total > 0 ? (totalResponseMinutes / total) : 0;
    const avgResponse = avgResponseVal.toFixed(1);

    const chartData = Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayName = format(date, 'EEE');
      const start = startOfDay(date);
      const end = endOfDay(date);

      const dayIssues = filteredIssues.filter(iss => {
        const created = new Date(iss.githubCreatedAt);
        return !isNaN(created.getTime()) && isWithinInterval(created, { start, end });
      }).length;

      const dayResolved = filteredIssues.filter(iss => {
        const resolved = iss.dateResolved ? new Date(iss.dateResolved) : (iss.status === 'CLOSED' ? new Date(iss.githubUpdatedAt) : null);
        return resolved && !isNaN(resolved.getTime()) && isWithinInterval(resolved, { start, end });
      }).length;

      return { name: dayName, issues: dayIssues, resolved: dayResolved };
    });

    const contributorMap = new Map<string, { role: string, activity: number }>();
    filteredIssues.forEach(iss => {
      const reporter = iss.reporterUsername;
      if (reporter) {
        const current = contributorMap.get(reporter) || { 
          role: teamLower.includes(reporter.toLowerCase()) ? 'Team Member' : 'External', 
          activity: 0 
        };
        contributorMap.set(reporter, { ...current, activity: current.activity + 1 });
      }
    });

    const contributors = Array.from(contributorMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.activity - a.activity)
      .slice(0, 5);

    return { total, active, resolvedToday, avgResponse, chartData, contributors };
  }, [rawIssues]);

  // 2. EARLY RETURN AFTER ALL HOOKS
  if (isLoading || !user) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight text-primary">Enterprise Dashboard</h2>
          <p className="text-muted-foreground">Monitoring Dhaka Team (L2) & Observations.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/issues">
              <RefreshCw className="h-4 w-4" /> Sync Tickets
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <h3 className="font-bold text-destructive">Data Access Error</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              We couldn't retrieve the enterprise data. Please check your permissions.
            </p>
          </CardContent>
        </Card>
      ) : (stats.total === 0) ? (
        <Card className="border-dashed border-2 bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center">
            <Ticket className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-bold">No Records Found</h3>
            <p className="text-muted-foreground max-sm mx-auto mb-6">
              No tickets match the Dhaka Team L2 or Observation status.
            </p>
            <Button asChild>
              <Link href="/issues">Sync Latest Data</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow border-primary/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Scoped</CardTitle>
                <Ticket className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">L2 + Observation Tickets</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow border-amber-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Issues</CardTitle>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.active}</div>
                <p className="text-xs text-amber-600 font-medium">Currently Open</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow border-green-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resolved Today</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+{stats.resolvedToday}</div>
                <p className="text-xs text-green-600 font-medium">Closures in 24h</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow border-blue-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Response</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avgResponse}</div>
                <p className="text-xs text-blue-600 font-medium">Σ(ResponseTime) / Total Tickets</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4 border-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Activity Trend
                </CardTitle>
                <CardDescription>Creation vs Resolution frequency (7 days).</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartData}>
                    <defs>
                      <linearGradient id="colorIssues" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <RechartsTooltip />
                    <Area type="monotone" dataKey="issues" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorIssues)" strokeWidth={3} name="New Issues" />
                    <Area type="monotone" dataKey="resolved" stroke="hsl(var(--secondary))" fillOpacity={1} fill="url(#colorResolved)" strokeWidth={3} name="Resolved" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 border-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Top Reporters
                </CardTitle>
                <CardDescription>Most active contributors in Project 181 scope.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {stats.contributors.length > 0 ? stats.contributors.map((person) => (
                    <div key={person.name} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-bold text-secondary-foreground text-xs ring-2 ring-background transition-transform group-hover:scale-110">
                          {person.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{person.name}</p>
                          <p className="text-xs text-muted-foreground">{person.role}</p>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                        {person.activity} items
                      </div>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                      <p className="text-sm font-medium">No activity found.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
