/**
 * @fileOverview KPI Calculation page for enterprise performance monitoring.
 * Projects: L2/181 (Dhaka Team), Workhub/358, Techsupport/305
 */
"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calculator, Target, Clock, Zap, Loader2,
  Calendar as CalendarIcon, Trophy, AlertTriangle, ExternalLink,
  AlertCircle, User, Hash, CheckCircle2, TrendingUp, TrendingDown,
  Users, ShieldAlert, PieChart, ArrowUpCircle, Activity,
  Briefcase, HeadphonesIcon, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart as RechartsPieChart, Pie,
} from 'recharts';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { getMonth, getYear, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  fetchGitHubIssuesAction,
  fetchWorkhubIssuesAction,
  fetchTechsupportIssuesAction,
} from '@/app/actions/github-sync';

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Agents whose tickets are tracked in Project 181 (Service Desk / L2).
 * Workhub (358) and Techsupport (305) use ALL boards — no agent filter.
 */
const SERVICE_DESK_AGENTS = [
  "faz-rifat", "emon-selise", "SaimunSelise",
  "Amir-Ahammed-SG", "zzsabit", "fahim-selise",
];

// Keep TEAM_MEMBERS as an alias so nothing else breaks
const TEAM_MEMBERS = SERVICE_DESK_AGENTS;

const MONTHS = [
  { label: "January", value: "0" }, { label: "February", value: "1" },
  { label: "March", value: "2" }, { label: "April", value: "3" },
  { label: "May", value: "4" }, { label: "June", value: "5" },
  { label: "July", value: "6" }, { label: "August", value: "7" },
  { label: "September", value: "8" }, { label: "October", value: "9" },
  { label: "November", value: "10" }, { label: "December", value: "11" },
];

// Generate years dynamically: 2026 → current year (data collected from Jan 2026 onwards)
const CURRENT_YEAR = new Date().getFullYear();
const DATA_START_YEAR = 2026;
const YEAR_OPTIONS = Array.from(
  { length: Math.max(CURRENT_YEAR - DATA_START_YEAR + 1, 1) },
  (_, i) => String(DATA_START_YEAR + i)
);

const SLA_RESPONSE_THRESHOLD_MINUTES = 60;
const SLA_SUPPORT_THRESHOLD_HOURS = 8;

const MEMBER_COLORS = [
  'hsl(var(--primary))', '#a855f7', '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
];
const CLIENT_COLORS = [
  'hsl(var(--primary))', '#a855f7', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#64748b',
];

// ── KPI Calculator (shared by all 3 projects) ─────────────────────────────────

function computeKPIs(
  rawIssues: any[],
  selectedMonth: string,
  selectedYear: string,
  filterFn?: (issue: any) => boolean,
  teamMembers?: string[],
  isEscalationProject?: boolean   // true only for Project 181
) {
  const empty = {
    total: 0, fcr: "0.0", art: "0.0", mttr: "0.0", chartData: [],
    top3LongestOpen: [] as any[], top3HighestSupport: [] as any[],
    unmanagedTickets: [], resolutionRate: "0.0", closedCount: 0, openCount: 0,
    memberHours: [], slaBreachRate: "0.0", slaBreachCount: 0, slaCompliantCount: 0,
    workloadData: [], clientTypeData: [], escalationRate: "0.0",
    escalatedCount: 0, nonEscalatedCount: 0,
  };

  if (!rawIssues || selectedMonth === "" || selectedYear === "") return empty;

  const targetMonth = parseInt(selectedMonth);
  const targetYear = parseInt(selectedYear);

  // If teamMembers provided (Service Desk), use them. Otherwise derive from ticket assignees/reporters.
  const resolvedTeam: string[] = teamMembers && teamMembers.length > 0
    ? teamMembers
    : Array.from(new Set(
        rawIssues.flatMap(issue => [
          ...(issue.assigneeUsernames || []),
          issue.reporterUsername || "",
          issue.closedBy || "",
        ].filter(Boolean))
      ));
  const teamLower = resolvedTeam.map((m: string) => m.toLowerCase());

  let filtered = rawIssues.filter(issue => {
    // Prefer dateReported (custom field) over githubCreatedAt (board addition date)
    const dateStr = issue.dateReported || issue.githubCreatedAt;
    const d = new Date(dateStr);
    // Only collect data from January 2026 onwards
    if (getYear(d) < 2026) return false;
    return getMonth(d) === targetMonth && getYear(d) === targetYear;
  });
  if (filterFn) filtered = filtered.filter(filterFn);

  const total = filtered.length;
  if (total === 0) return { ...empty };

  // Core KPIs
  const fcrYesCount = filtered.filter(i => (i.fcr || "").toLowerCase() === 'yes').length;
  const fcr = ((fcrYesCount / total) * 100).toFixed(1);

  const totalRT = filtered.reduce((a, c) => a + (parseFloat(c.responseTimeMinutes) || 0), 0);
  const art = (totalRT / total).toFixed(1);

  const totalSH = filtered.reduce((a, c) => a + (parseFloat(c.supportHours) || 0), 0);
  const mttr = (totalSH / total).toFixed(1);

  // Unmanaged
  const unmanagedTickets = filtered.filter(i => {
    const closed = (i.status || "").toUpperCase() === 'CLOSED' || (i.customStatus || "").toLowerCase() === 'done';
    if (!closed) return false;
    return (
      isNaN(parseFloat(i.responseTimeMinutes)) || parseFloat(i.responseTimeMinutes) === 0 ||
      isNaN(parseFloat(i.supportHours)) || parseFloat(i.supportHours) === 0 ||
      !i.fcr || i.fcr === "" ||
      !i.closedBy || i.closedBy === ""
    );
  });

  // Top 3 Longest Open Tickets & Top 3 Highest Support Hours
  // Scope: Label L2 + Status "Dhaka Team (L2)" (same as before)
  const l2Candidates = filtered.filter(issue => {
    const hasL2Label = issue.labelNames?.some((l: string) => l.toUpperCase() === 'L2');
    const hasL2Status = issue.customStatus === 'Dhaka Team (L2)';
    return hasL2Label && hasL2Status;
  });

  const top3LongestOpen = l2Candidates
    .map(issue => {
      const created = new Date(issue.githubCreatedAt);
      const resolved = issue.dateResolved
        ? new Date(issue.dateResolved)
        : (issue.status === 'CLOSED' ? new Date(issue.githubUpdatedAt) : new Date());
      return { ...issue, durationDays: differenceInDays(resolved, created) };
    })
    .sort((a, b) => b.durationDays - a.durationDays)
    .slice(0, 3);

  const top3HighestSupport = l2Candidates
    .map(issue => ({ ...issue, totalHours: parseFloat(issue.supportHours) || 0 }))
    .filter(issue => issue.totalHours > 0)
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, 3);

  const chartData = [
    { name: 'FCR %', value: parseFloat(fcr), color: 'hsl(var(--primary))' },
    { name: 'ART', value: parseFloat(art), color: 'hsl(var(--secondary))' },
    { name: 'MTTR', value: parseFloat(mttr), color: '#a855f7' },
  ];

  // Resolution Rate
  const closedCount = filtered.filter(i =>
    (i.status || "").toUpperCase() === 'CLOSED' || (i.customStatus || "").toLowerCase() === 'done'
  ).length;
  const resolutionRate = ((closedCount / total) * 100).toFixed(1);

  // Member Hours
  const mhMap: Record<string, { tickets: number; hours: number }> = {};
  resolvedTeam.forEach((m: string) => { mhMap[m.toLowerCase()] = { tickets: 0, hours: 0 }; });
  filtered.forEach(issue => {
    const closer = (issue.closedBy || "").toLowerCase();
    const reporter = (issue.reporterUsername || "").toLowerCase();
    const key = teamLower.includes(closer) ? closer : teamLower.includes(reporter) ? reporter : null;
    if (key) { mhMap[key].tickets += 1; mhMap[key].hours += parseFloat(issue.supportHours) || 0; }
  });
  const memberHours = resolvedTeam
    .map((m: string, i: number) => ({ name: m, color: MEMBER_COLORS[i % MEMBER_COLORS.length], ...mhMap[m.toLowerCase()], avgHours: mhMap[m.toLowerCase()].tickets > 0 ? parseFloat((mhMap[m.toLowerCase()].hours / mhMap[m.toLowerCase()].tickets).toFixed(1)) : 0 }))
    .filter(m => m.tickets > 0).sort((a, b) => b.avgHours - a.avgHours);

  // SLA
  const slaBreachCount = filtered.filter(i =>
    (parseFloat(i.responseTimeMinutes) || 0) > SLA_RESPONSE_THRESHOLD_MINUTES ||
    (parseFloat(i.supportHours) || 0) > SLA_SUPPORT_THRESHOLD_HOURS
  ).length;
  const slaBreachRate = ((slaBreachCount / total) * 100).toFixed(1);

  // Workload
  const wlMap: Record<string, number> = {};
  filtered.forEach(issue => {
    const assignees: string[] = issue.assigneeUsernames || [];
    const reporter = (issue.reporterUsername || "").toLowerCase();
    let hit = false;
    assignees.forEach((a: string) => { const al = a.toLowerCase(); if (teamLower.includes(al)) { wlMap[al] = (wlMap[al] || 0) + 1; hit = true; } });
    if (!hit && teamLower.includes(reporter)) wlMap[reporter] = (wlMap[reporter] || 0) + 1;
    // For dynamic mode (no fixed team), also count unmatched assignees
    if (!hit && assignees.length > 0 && teamLower.length === 0) {
      assignees.forEach((a: string) => { const al = a.toLowerCase(); wlMap[al] = (wlMap[al] || 0) + 1; });
    }
  });
  const workloadData = resolvedTeam
    .map((m: string, i: number) => ({ name: m, shortName: m.length > 12 ? m.substring(0, 10) + '…' : m, tickets: wlMap[m.toLowerCase()] || 0, color: MEMBER_COLORS[i % MEMBER_COLORS.length] }))
    .filter(m => m.tickets > 0).sort((a, b) => b.tickets - a.tickets);

  // Client Type
  const ctMap: Record<string, number> = {};
  filtered.forEach(i => { const ct = (i.clientType || "Unknown").trim() || "Unknown"; ctMap[ct] = (ctMap[ct] || 0) + 1; });
  const clientTypeData = Object.entries(ctMap)
    .map(([name, value], i) => ({ name, value, pct: parseFloat(((value / total) * 100).toFixed(1)), color: CLIENT_COLORS[i % CLIENT_COLORS.length] }))
    .sort((a, b) => b.value - a.value);

  // Escalation: Only applies to Project 181.
  // A ticket is "escalated" if it was moved to/through "Dhaka Team (L2)"
  // status, EXCLUDING those currently in "Under Observation (L2)".
  const escalatedCount = isEscalationProject
    ? filtered.filter(i => {
        const status = (i.customStatus || "").toLowerCase().trim();
        const isUnderObservation = status === 'under observation (l2)';
        const isDhakaL2 = status === 'dhaka team (l2)';
        const hasL2Label = i.labelNames?.some((l: string) => l.toUpperCase() === 'L2') || false;
        // Escalated = reached Dhaka Team (L2) AND is NOT currently "Under Observation (L2)"
        return (isDhakaL2 || hasL2Label) && !isUnderObservation;
      }).length
    : 0;
  const escalationRate = isEscalationProject
    ? ((escalatedCount / total) * 100).toFixed(1)
    : "N/A";

  return {
    total, fcr, art, mttr, chartData,
    top3LongestOpen, top3HighestSupport, unmanagedTickets,
    resolutionRate, closedCount, openCount: total - closedCount,
    memberHours, slaBreachRate, slaBreachCount, slaCompliantCount: total - slaBreachCount,
    workloadData, clientTypeData,
    escalationRate, escalatedCount, nonEscalatedCount: total - escalatedCount,
  };
}

// ── Static color map for outlier cards (avoids Tailwind purging dynamic class strings) ──
const CARD_COLOR_CLASSES: Record<string, { card: string; title: string; badge: string }> = {
  amber: {
    card:  "border-amber-200 bg-amber-50/30",
    title: "text-amber-700",
    badge: "bg-white text-amber-700 border-amber-200",
  },
  purple: {
    card:  "border-purple-200 bg-purple-50/30",
    title: "text-purple-700",
    badge: "bg-white text-purple-700 border-purple-200",
  },
  green: {
    card:  "border-green-200 bg-green-50/30",
    title: "text-green-700",
    badge: "bg-white text-green-700 border-green-200",
  },
  sky: {
    card:  "border-sky-200 bg-sky-50/30",
    title: "text-sky-700",
    badge: "bg-white text-sky-700 border-sky-200",
  },
};

// ── Shared KPI Panel ───────────────────────────────────────────────────────────

function KPIPanel({ stats, selectedMonth }: { stats: ReturnType<typeof computeKPIs>; selectedMonth: string }) {
  const rrNum = parseFloat(stats.resolutionRate);
  const slaNum = parseFloat(stats.slaBreachRate);
  const escNum = stats.escalationRate === "N/A" ? 0 : parseFloat(stats.escalationRate);

  return (
    <div className="space-y-8">
      {/* Core 3 KPIs */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm border-primary/20 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground flex items-center justify-between">FCR Rate <Target className="h-4 w-4 text-primary" /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats.fcr}%</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">First Contact Resolution</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-secondary/20 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground flex items-center justify-between">Avg Response <Clock className="h-4 w-4 text-secondary-foreground" /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary-foreground">{stats.art}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">Σ(ResponseTime) / Total Tickets</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-purple-100 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground flex items-center justify-between">Mean Support <Zap className="h-4 w-4 text-purple-500" /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.mttr}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">Σ(SupportHours) / Total Tickets</p>
          </CardContent>
        </Card>
      </div>

      {/* Outlier Cards — Top 3 each */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top 3 Longest Open Tickets */}
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" /> Top 3 Longest Open Tickets
            </CardTitle>
            <CardDescription>Label L2 + Status "Dhaka Team (L2)" — by open duration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.top3LongestOpen.length > 0 ? stats.top3LongestOpen.map((data, idx) => (
              <div key={data.id || idx} className="flex items-start justify-between gap-3 p-2 rounded-md bg-white/60 border border-amber-100">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-[10px] font-black text-amber-400 w-4 shrink-0 mt-0.5">#{idx + 1}</span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-bold leading-tight truncate">{data.title}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">#{data.githubIssueNumber}</p>
                    <a href={data.url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-primary font-bold flex items-center gap-1 hover:underline">
                      VIEW ON GITHUB <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
                <Badge variant="outline" className="bg-white text-amber-700 border-amber-200 whitespace-nowrap shrink-0">
                  {data.durationDays} Days
                </Badge>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4 italic">No L2 records found for this period.</p>
            )}
          </CardContent>
        </Card>

        {/* Top 3 Highest Support Hours Tickets */}
        <Card className="border-purple-200 bg-purple-50/30">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-purple-700">
              <Trophy className="h-4 w-4" /> Top 3 Highest Support Hours
            </CardTitle>
            <CardDescription>Label L2 + Status "Dhaka Team (L2)" — by support hours logged</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.top3HighestSupport.length > 0 ? stats.top3HighestSupport.map((data, idx) => (
              <div key={data.id || idx} className="flex items-start justify-between gap-3 p-2 rounded-md bg-white/60 border border-purple-100">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-[10px] font-black text-purple-400 w-4 shrink-0 mt-0.5">#{idx + 1}</span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-bold leading-tight truncate">{data.title}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">#{data.githubIssueNumber}</p>
                    <a href={data.url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-primary font-bold flex items-center gap-1 hover:underline">
                      VIEW ON GITHUB <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
                <Badge variant="outline" className="bg-white text-purple-700 border-purple-200 whitespace-nowrap shrink-0">
                  {data.totalHours} Hrs
                </Badge>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4 italic">No L2 records found for this period.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Extended KPIs divider */}
      <div className="flex items-center gap-4 pt-2">
        <div className="h-px flex-1 bg-border" />
        <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 border border-primary/20 rounded-full">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Extended KPIs</span>
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Resolution Rate + SLA */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm hover:shadow-md transition-shadow border-emerald-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center justify-between text-emerald-700">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Ticket Resolution Rate</span>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold">{stats.resolutionRate}%</Badge>
            </CardTitle>
            <CardDescription>% of tickets closed vs total in period</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={rrNum} className="h-3 bg-muted" />
            <div className="grid grid-cols-3 divide-x divide-border border rounded-lg overflow-hidden bg-muted/20">
              {[["Total", stats.total, ""], ["Closed", stats.closedCount, "text-emerald-600"], ["Open", stats.openCount, "text-amber-600"]].map(([label, val, cls]) => (
                <div key={label as string} className="p-3 text-center">
                  <div className={`text-xl font-black ${cls}`}>{val}</div>
                  <div className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {rrNum >= 70 ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
              <span>{rrNum >= 70 ? "Resolution rate is healthy (≥70%)" : "Below target (70%)"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center justify-between text-red-700">
              <span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> SLA Breach Rate</span>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs font-bold">{stats.slaBreachRate}%</Badge>
            </CardTitle>
            <CardDescription>RT &gt; {SLA_RESPONSE_THRESHOLD_MINUTES} min or SH &gt; {SLA_SUPPORT_THRESHOLD_HOURS} hrs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={slaNum} className="h-3 bg-muted [&>div]:bg-red-500" />
            <div className="grid grid-cols-3 divide-x divide-border border rounded-lg overflow-hidden bg-muted/20">
              {[["Total", stats.total, ""], ["Breached", stats.slaBreachCount, "text-red-600"], ["Compliant", stats.slaCompliantCount, "text-emerald-600"]].map(([label, val, cls]) => (
                <div key={label as string} className="p-3 text-center">
                  <div className={`text-xl font-black ${cls}`}>{val}</div>
                  <div className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {slaNum <= 20 ? <TrendingDown className="h-3 w-3 text-emerald-500" /> : <TrendingUp className="h-3 w-3 text-destructive" />}
              <span>{slaNum <= 20 ? "Within acceptable range (≤20%)" : "Above target — review thresholds"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Escalation Rate — Project 181 only */}
      {stats.escalationRate !== "N/A" && (
      <Card className="shadow-sm hover:shadow-md transition-shadow border-orange-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center justify-between text-orange-700">
            <span className="flex items-center gap-2"><ArrowUpCircle className="h-4 w-4" /> Escalation Rate</span>
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs font-bold">{stats.escalationRate}%</Badge>
          </CardTitle>
          <CardDescription>Tickets moved to "Dhaka Team (L2)", excluding "Under Observation (L2)"</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={[{ name: 'Escalated', value: stats.escalatedCount, fill: '#f97316' }, { name: 'Non-Escalated', value: stats.nonEscalatedCount, fill: '#e5e7eb' }]}
                    cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" />
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="md:col-span-2 grid grid-cols-3 divide-x divide-border border rounded-lg overflow-hidden bg-muted/20">
              {[["Total", stats.total, ""], ["Escalated", stats.escalatedCount, "text-orange-600"], ["Non-Escalated", stats.nonEscalatedCount, "text-slate-500"]].map(([label, val, cls]) => (
                <div key={label as string} className="p-4 text-center">
                  <div className={`text-2xl font-black ${cls}`}>{val}</div>
                  <div className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
            {escNum <= 30 ? <TrendingDown className="h-3 w-3 text-emerald-500" /> : <TrendingUp className="h-3 w-3 text-destructive" />}
            <span>{escNum <= 30 ? "Within healthy range (≤30%)" : "Elevated — consider L1 training or process review"}</span>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Workload Distribution */}
      <Card className="shadow-sm hover:shadow-md transition-shadow border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-700"><Users className="h-4 w-4" /> Team Workload Distribution</CardTitle>
          <CardDescription>Tickets attributed per team member</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.workloadData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.workloadData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#f0f0f0" />
                    <XAxis type="number" allowDecimals={false} fontSize={10} />
                    <YAxis dataKey="shortName" type="category" axisLine={false} tickLine={false} fontSize={9} width={90} />
                    <Tooltip formatter={(v) => [`${v} tickets`, 'Workload']} />
                    <Bar dataKey="tickets" radius={[0, 4, 4, 0]} barSize={20}>
                      {stats.workloadData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {stats.workloadData.map((m, idx) => {
                  const pct = stats.total > 0 ? ((m.tickets / stats.total) * 100).toFixed(0) : "0";
                  return (
                    <div key={m.name} className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-muted-foreground w-4 text-right">{idx + 1}</span>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-[11px] font-bold truncate max-w-[130px]">{m.name}</span>
                          <span className="text-[11px] font-bold" style={{ color: m.color }}>{m.tickets} tickets</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.color }} />
                        </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground w-8 text-right font-bold">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8 italic">No workload data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Member Hours + Client Type */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm hover:shadow-md transition-shadow border-violet-200">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-violet-700"><Clock className="h-4 w-4" /> Avg Support Hours / Member</CardTitle>
            <CardDescription>Total support hours and average per ticket per member</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.memberHours.length > 0 ? (
              <div className="space-y-3">
                {stats.memberHours.map((m) => (
                  <div key={m.name} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                        <span className="font-bold">{m.name}</span>
                        <span className="text-muted-foreground">({m.tickets} ticket{m.tickets !== 1 ? 's' : ''})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-[10px]">{m.hours.toFixed(1)} total hrs</span>
                        <Badge variant="outline" className="text-[9px] h-4 font-bold" style={{ color: m.color, borderColor: m.color + '40', background: m.color + '10' }}>{m.avgHours} avg</Badge>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${stats.memberHours[0]?.avgHours > 0 ? Math.min((m.avgHours / stats.memberHours[0].avgHours) * 100, 100) : 0}%`, background: m.color }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8 italic">No member support data.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-teal-200">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-teal-700"><PieChart className="h-4 w-4" /> Client Type Breakdown</CardTitle>
            <CardDescription>Ticket volume by client type</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.clientTypeData.length > 0 ? (
              <div className="space-y-4">
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie data={stats.clientTypeData} cx="50%" cy="50%" outerRadius={70} paddingAngle={2} dataKey="value">
                        {stats.clientTypeData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [`${v} tickets`, n]} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {stats.clientTypeData.map((ct) => (
                    <div key={ct.name} className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: ct.color }} />
                      <span className="text-[11px] font-bold flex-1 truncate">{ct.name}</span>
                      <span className="text-[11px] text-muted-foreground">{ct.value} tickets</span>
                      <Badge variant="outline" className="text-[9px] h-4 font-bold" style={{ color: ct.color, borderColor: ct.color + '40' }}>{ct.pct}%</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8 italic">No client type data.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unmanaged Tickets */}
      <Card className="border-none shadow-md overflow-hidden bg-card">
        <CardHeader className="bg-destructive/5 border-b border-destructive/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-destructive"><AlertCircle className="h-5 w-5" /> Unmanaged Tickets</CardTitle>
            {stats.unmanagedTickets.length > 0 && (
              <Badge className="bg-destructive text-destructive-foreground text-sm font-black px-3 py-1">
                {stats.unmanagedTickets.length}
              </Badge>
            )}
          </div>
          <CardDescription>Closed tickets missing RT, SH, FCR, or Resolved By.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[100px]"><Hash className="h-3 w-3 inline mr-1" /> No.</TableHead>
                <TableHead>Ticket Summary</TableHead>
                <TableHead>Missing Field(s)</TableHead>
                <TableHead><User className="h-3 w-3 inline mr-1" /> Resolved By</TableHead>
                <TableHead className="text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.unmanagedTickets.length > 0 ? stats.unmanagedTickets.map((ticket) => (
                <TableRow key={ticket.id} className="hover:bg-muted/20">
                  <TableCell className="font-mono text-xs opacity-60">#{ticket.githubIssueNumber}</TableCell>
                  <TableCell className="font-bold text-sm max-w-[300px] truncate">{ticket.title}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(parseFloat(ticket.responseTimeMinutes) === 0 || isNaN(parseFloat(ticket.responseTimeMinutes))) && <Badge variant="outline" className="text-[8px] h-4 bg-red-50 text-red-600 border-red-100">RT Missing</Badge>}
                      {(parseFloat(ticket.supportHours) === 0 || isNaN(parseFloat(ticket.supportHours))) && <Badge variant="outline" className="text-[8px] h-4 bg-orange-50 text-orange-600 border-orange-100">SH Missing</Badge>}
                      {(!ticket.fcr || ticket.fcr === "") && <Badge variant="outline" className="text-[8px] h-4 bg-amber-50 text-amber-600 border-amber-100">FCR Missing</Badge>}
                      {(!ticket.closedBy || ticket.closedBy === "") && <Badge variant="outline" className="text-[8px] h-4 bg-gray-50 text-gray-600 border-gray-100">Resolved By Missing</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-semibold">{ticket.closedBy || <span className="text-muted-foreground italic opacity-50">Not Captured</span>}</TableCell>
                  <TableCell className="text-right">
                    <a href={ticket.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted text-primary"><ExternalLink className="h-4 w-4" /></a>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">All closed tickets are fully managed.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Service Desk / Workhub / Techsupport Section (with Sync button) ─────────────────────────

function ProjectKPISection({
  projectId, projectLabel, projectNumber, fetchAction, selectedMonth, selectedYear, agentFilter,
}: {
  projectId: string; projectLabel: string; projectNumber: number;
  fetchAction: () => Promise<{ success: boolean; items?: any[]; error?: string }>;
  selectedMonth: string; selectedYear: string;
  agentFilter?: string[];
}) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const issuesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'enterprise-projects', projectId, 'issues'), orderBy('githubCreatedAt', 'desc'));
  }, [db, user, projectId]);

  const { data: rawIssues, isLoading } = useCollection(issuesQuery);

  const stats = useMemo(() => {
    if (agentFilter && agentFilter.length > 0) {
      // Project 181: filter tickets where an agent PARTICIPATED (assignee, reporter, or closedBy)
      const agentsLower = agentFilter.map(m => m.toLowerCase());
      return computeKPIs(rawIssues || [], selectedMonth, selectedYear, (issue) => {
        const isTeamAuthor    = agentsLower.includes((issue.reporterUsername || "").toLowerCase());
        const isTeamAssignee  = (issue.assigneeUsernames || []).some(
          (a: string) => agentsLower.includes(a.toLowerCase())
        );
        const isTeamCloser    = agentsLower.includes((issue.closedBy || "").toLowerCase());
        // Include if the agent participated in any capacity
        return isTeamAuthor || isTeamAssignee || isTeamCloser;
      }, agentFilter, true /* isEscalationProject */);
    }
    // Projects 358 & 305: all participating agents, no escalation rate
    return computeKPIs(rawIssues || [], selectedMonth, selectedYear, undefined, undefined, false);
  }, [rawIssues, selectedMonth, selectedYear, agentFilter]);

  const handleSync = async () => {
    if (!db || !user) return;
    setSyncing(true);
    try {
      const result = await fetchAction();
      if (!result.success) throw new Error(result.error);
      const items = result.items || [];
      const issuesCollection = collection(db, 'enterprise-projects', projectId, 'issues');

      setDocumentNonBlocking(doc(db, 'enterprise-projects', projectId), {
        id: projectId, githubProjectNumber: projectNumber,
        githubOrgName: "SELISEdigitalplatforms", githubRepoName: projectLabel,
        lastFetchedAt: new Date().toISOString(),
      }, { merge: true });

      let count = 0;
      for (const item of items) {
        if (!item.content?.number) continue;
        const content = item.content;
        const issueId = `${projectId}-issue-${content.number}`;
        const issueRef = doc(issuesCollection, issueId);
        const latestComment = content.comments?.nodes?.[0] || null;

        const fieldMap: Record<string, string> = {};
        item.fieldValues?.nodes?.forEach((val: any) => {
          if (!val?.field?.name) return;
          const fName = val.field.name.toLowerCase().trim();
          const fVal = val.text ?? val.date ?? val.name ?? val.title
            ?? val.users?.nodes?.[0]?.login
            ?? (val.number !== undefined ? String(val.number) : "");
          if (fVal !== "") fieldMap[fName] = String(fVal);
        });

        const gfv = (terms: string[]) => {
          for (const t of terms) { const v = fieldMap[t.toLowerCase().trim()]; if (v) return v; }
          return "";
        };

        setDocumentNonBlocking(issueRef, {
          id: issueId, githubIssueNumber: content.number,
          title: content.title || "No Title", description: content.body || "",
          status: content.state || "UNKNOWN", url: content.url || "",
          reporterUsername: content.author?.login || "unknown",
          assigneeUsernames: content.assignees?.nodes?.map((n: any) => n.login) || [],
          closedBy: gfv(["closed by", "closer", "completed by", "closedby", "mark as completed"]) || (content.closed ? "GitHub System" : ""),
          labelNames: content.labels?.nodes?.map((n: any) => n.name) || [],
          projectId, githubCreatedAt: gfv(["date reported", "reported at"]) || item.createdAt || new Date().toISOString(),
          githubUpdatedAt: content.updatedAt || new Date().toISOString(),
          lastFetchedAt: new Date().toISOString(),
          dateReported: gfv(["date reported", "reported at"]),
          dateResolved: gfv(["date resolved", "resolved at", "completion date"]),
          clientType: gfv(["client type", "client"]),
          supportHours: gfv(["support hours", "support hour", "sh", "effort"]) || "0",
          responseTimeMinutes: gfv(["response time (minutes)", "response time (mins)", "response time", "rt"]) || "0",
          fcr: gfv(["fcr", "fcr status"]) || "",
          customStatus: gfv(["status", "current status"]) || "",
          latestCommentBody: latestComment?.body || "",
          latestCommentAuthor: latestComment?.author?.login || "",
          latestCommentAt: latestComment?.createdAt || "",
          contentType: content.__typename || "Issue",
        }, { merge: true });
        count++;
      }

      toast({ title: "Sync Successful", description: `${projectLabel}: ${count} records updated.` });
    } catch (error: any) {
      toast({ title: "Sync Error", description: error.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) return (
    <div className="flex h-[40vh] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Card className="px-4 py-2 bg-primary text-primary-foreground shadow-md">
            <div className="text-center">
              <div className="text-3xl font-black">{stats.total}</div>
              <div className="text-[9px] uppercase font-medium opacity-70">Total Tickets</div>
            </div>
          </Card>
          <Card className="px-4 py-2 bg-emerald-600 text-white shadow-md">
            <div className="text-center">
              <div className="text-3xl font-black">{stats.closedCount}</div>
              <div className="text-[9px] uppercase font-medium opacity-70">Closed</div>
            </div>
          </Card>
          <Card className="px-4 py-2 bg-amber-500 text-white shadow-md">
            <div className="text-center">
              <div className="text-3xl font-black">{stats.openCount}</div>
              <div className="text-[9px] uppercase font-medium opacity-70">Open</div>
            </div>
          </Card>
          <div>
            <p className="text-sm font-bold">{MONTHS[parseInt(selectedMonth)]?.label} {selectedYear}</p>
            <p className="text-xs text-muted-foreground">GitHub Project #{projectNumber}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="gap-2">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {syncing ? "Syncing…" : `Sync ${projectLabel}`}
        </Button>
      </div>

      {stats.total === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <RefreshCw className="h-8 w-8 text-muted-foreground opacity-30" />
            <p className="text-sm font-bold text-muted-foreground">No data for this period</p>
            <p className="text-xs text-muted-foreground">
              Click <strong>Sync {projectLabel}</strong> to fetch tickets from GitHub Project #{projectNumber}, then select the correct month.
            </p>
          </CardContent>
        </Card>
      ) : (
        <KPIPanel stats={stats} selectedMonth={selectedMonth} />
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function KPIPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(getMonth(now).toString());
    setSelectedYear(getYear(now).toString());
  }, []);



  if (!user || selectedMonth === "") {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Calculator className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Performance Metrics</h2>
        </div>
        <p className="text-muted-foreground">Enterprise KPI analysis — L2, Workhub &amp; Techsupport.</p>
      </div>

      {/* Period Selector */}
      <Card className="bg-muted/30">
        <CardHeader className="py-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-2">
            <CalendarIcon className="h-3 w-3" /> Report Period
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 max-w-sm">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Month</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="bg-background h-9"><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Year</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="bg-background h-9"><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="l2" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="l2" className="gap-2">
            <Activity className="h-4 w-4" /> Service Desk
          </TabsTrigger>
          <TabsTrigger value="workhub" className="gap-2">
            <Briefcase className="h-4 w-4" /> Workhub
          </TabsTrigger>
          <TabsTrigger value="techsupport" className="gap-2">
            <HeadphonesIcon className="h-4 w-4" /> Techsupport
          </TabsTrigger>
        </TabsList>

        <TabsContent value="l2">
          <ProjectKPISection
            projectId="github-project-181"
            projectLabel="Service Desk"
            projectNumber={181}
            fetchAction={fetchGitHubIssuesAction}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            agentFilter={SERVICE_DESK_AGENTS}
          />
        </TabsContent>

        <TabsContent value="workhub">
          <ProjectKPISection
            projectId="github-project-358"
            projectLabel="Workhub"
            projectNumber={358}
            fetchAction={fetchWorkhubIssuesAction}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        </TabsContent>

        <TabsContent value="techsupport">
          <ProjectKPISection
            projectId="github-project-305"
            projectLabel="Techsupport"
            projectNumber={305}
            fetchAction={fetchTechsupportIssuesAction}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
