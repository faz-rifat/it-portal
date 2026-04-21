/**
 * @fileOverview KPI Calculation page for enterprise performance monitoring.
 */
"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calculator,
  Target,
  Clock,
  Zap,

  Loader2,
  Calendar as CalendarIcon,
  Trophy,
  AlertTriangle,
  ExternalLink,
  AlertCircle,
  User,
  Hash,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Users,
  ShieldAlert,
  PieChart,
  ArrowUpCircle,
  Activity
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
  Legend,
  RadialBarChart,
  RadialBar
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { getMonth, getYear, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const TEAM_MEMBERS = [
  "faz-rifat",
  "emon-selise",
  "SaimunSelise",
  "Amir-Ahammed-SG",
  "zzsabit",
  "fahim-selise"
];

const MONTHS = [
  { label: "January", value: "0" },
  { label: "February", value: "1" },
  { label: "March", value: "2" },
  { label: "April", value: "3" },
  { label: "May", value: "4" },
  { label: "June", value: "5" },
  { label: "July", value: "6" },
  { label: "August", value: "7" },
  { label: "September", value: "8" },
  { label: "October", value: "9" },
  { label: "November", value: "10" },
  { label: "December", value: "11" },
];

// SLA threshold in minutes — adjust as needed
const SLA_RESPONSE_THRESHOLD_MINUTES = 60;
// SLA support hours threshold
const SLA_SUPPORT_THRESHOLD_HOURS = 8;

const MEMBER_COLORS = [
  'hsl(var(--primary))',
  '#a855f7',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
];

export default function KPIPage() {
  // 1. ALL HOOKS AT THE TOP
  const { user } = useUser();
  const db = useFirestore();

  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(getMonth(now).toString());
    setSelectedYear(getYear(now).toString());
  }, []);

  const issuesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'enterprise-projects', 'github-project-181', 'issues'),
      orderBy('githubCreatedAt', 'desc')
    );
  }, [db, user]);

  const { data: rawIssues, isLoading } = useCollection(issuesQuery);

  const stats = useMemo(() => {
    const empty = {
      total: 0,
      fcr: "0.0",
      art: "0.0",
      mttr: "0.0",
      chartData: [],
      longestOpen: null,
      highestSupport: null,
      highestResolution: null,
      lowestResolution: null,
      unmanagedTickets: [],
      // New KPIs
      resolutionRate: "0.0",
      closedCount: 0,
      openCount: 0,
      memberHours: [],
      slaBreachRate: "0.0",
      slaBreachCount: 0,
      slaCompliantCount: 0,
      workloadData: [],
      clientTypeData: [],
      escalationRate: "0.0",
      escalatedCount: 0,
      nonEscalatedCount: 0,
    };

    if (!rawIssues || selectedMonth === "" || selectedYear === "") return empty;

    const teamLower = TEAM_MEMBERS.map(m => m.toLowerCase());
    const targetMonth = parseInt(selectedMonth);
    const targetYear = parseInt(selectedYear);

    // Filter for the scoped items (Same as Dashboard)
    const filtered = rawIssues.filter(issue => {
      const issueDate = new Date(issue.githubCreatedAt);
      const matchesDate = getMonth(issueDate) === targetMonth && getYear(issueDate) === targetYear;

      const isTeamAuthor = teamLower.includes(issue.reporterUsername?.toLowerCase() || "");
      const isL2Status = issue.customStatus === 'Dhaka Team (L2)';
      const isObservingStatus = issue.customStatus === 'Under Observation (L2)';
      const isL2Label = issue.labelNames?.some((l: string) => l.toUpperCase() === 'L2') || false;

      return matchesDate && (isTeamAuthor || isL2Status || isObservingStatus || isL2Label);
    });

    const total = filtered.length;
    if (total === 0) return { ...empty, total: 0 };

    // ── EXISTING KPIs ──────────────────────────────────────────────────────────

    const fcrYesCount = filtered.filter(i => (i.fcr || "").toLowerCase() === 'yes').length;
    const fcr = ((fcrYesCount / total) * 100).toFixed(1);

    const totalResponseTime = filtered.reduce((acc, curr) => {
      const val = parseFloat(curr.responseTimeMinutes);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const art = (totalResponseTime / total).toFixed(1);

    const totalSupportHours = filtered.reduce((acc, curr) => {
      const val = parseFloat(curr.supportHours);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const mttr = (totalSupportHours / total).toFixed(1);

    // Unmanaged Tickets
    const unmanagedTickets = filtered.filter(i => {
      const isClosed = (i.status || "").toUpperCase() === 'CLOSED' || (i.customStatus || "").toLowerCase() === 'done';
      if (!isClosed) return false;
      const rtValue = parseFloat(i.responseTimeMinutes);
      const shValue = parseFloat(i.supportHours);
      const rtMissing = isNaN(rtValue) || rtValue === 0;
      const shMissing = isNaN(shValue) || shValue === 0;
      const fcrMissing = !i.fcr || i.fcr === "";
      const closerMissing = !i.closedBy || i.closedBy === "";
      return rtMissing || shMissing || fcrMissing || closerMissing;
    });

    // Outlier logic (Label L2 AND Status Dhaka Team L2)
    let longestOpen: any = null;
    let maxDays = -1;
    let highestSupport: any = null;
    let maxHours = -1;
    let highestResolution: any = null;
    let maxResolutionHours = -1;
    let lowestResolution: any = null;
    let minResolutionHours = Infinity;

    filtered.forEach(issue => {
      const hasL2Label = issue.labelNames?.some((l: string) => l.toUpperCase() === 'L2');
      const hasL2Status = issue.customStatus === 'Dhaka Team (L2)';
      if (hasL2Label && hasL2Status) {
        const created = new Date(issue.githubCreatedAt);
        const resolved = issue.dateResolved ? new Date(issue.dateResolved) : (issue.status === 'CLOSED' ? new Date(issue.githubUpdatedAt) : new Date());
        const days = differenceInDays(resolved, created);
        if (days > maxDays) { maxDays = days; longestOpen = { ...issue, durationDays: days }; }
        const hours = parseFloat(issue.supportHours) || 0;
        if (hours > maxHours) { maxHours = hours; highestSupport = { ...issue, totalHours: hours }; }
        const isClosed = (issue.status || "").toUpperCase() === 'CLOSED' || (issue.customStatus || "").toLowerCase() === 'done';
        if (isClosed) {
          const resDays = differenceInDays(resolved, created);
          if (resDays > maxResolutionHours) { maxResolutionHours = resDays; highestResolution = { ...issue, resolutionDays: resDays }; }
          if (resDays < minResolutionHours) { minResolutionHours = resDays; lowestResolution = { ...issue, resolutionDays: resDays }; }
        }
      }
    });

    const chartData = [
      { name: 'FCR %', value: parseFloat(fcr), color: 'hsl(var(--primary))' },
      { name: 'ART', value: parseFloat(art), color: 'hsl(var(--secondary))' },
      { name: 'MTTR', value: parseFloat(mttr), color: '#a855f7' },
    ];

    // ── NEW KPI 1: Ticket Resolution Rate ─────────────────────────────────────
    const closedCount = filtered.filter(i =>
      (i.status || "").toUpperCase() === 'CLOSED' || (i.customStatus || "").toLowerCase() === 'done'
    ).length;
    const openCount = total - closedCount;
    const resolutionRate = ((closedCount / total) * 100).toFixed(1);

    // ── NEW KPI 2: Avg Support Hours per Member ────────────────────────────────
    const memberHoursMap: Record<string, { tickets: number; hours: number }> = {};
    TEAM_MEMBERS.forEach(m => { memberHoursMap[m.toLowerCase()] = { tickets: 0, hours: 0 }; });

    filtered.forEach(issue => {
      const closer = (issue.closedBy || "").toLowerCase();
      const reporter = (issue.reporterUsername || "").toLowerCase();
      const key = teamLower.includes(closer) ? closer : teamLower.includes(reporter) ? reporter : null;
      if (key) {
        memberHoursMap[key].tickets += 1;
        const sh = parseFloat(issue.supportHours) || 0;
        memberHoursMap[key].hours += sh;
      }
    });

    const memberHours = TEAM_MEMBERS
      .map((m, idx) => {
        const data = memberHoursMap[m.toLowerCase()];
        return {
          name: m,
          shortName: m.split('-')[0] || m.split('S')[0] || m,
          tickets: data.tickets,
          hours: data.hours,
          avgHours: data.tickets > 0 ? parseFloat((data.hours / data.tickets).toFixed(1)) : 0,
          color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
        };
      })
      .filter(m => m.tickets > 0)
      .sort((a, b) => b.avgHours - a.avgHours);

    // ── NEW KPI 3: SLA Breach Rate ─────────────────────────────────────────────
    // A ticket is an SLA breach if responseTimeMinutes > threshold OR supportHours > support threshold
    const slaBreachCount = filtered.filter(i => {
      const rt = parseFloat(i.responseTimeMinutes) || 0;
      const sh = parseFloat(i.supportHours) || 0;
      return rt > SLA_RESPONSE_THRESHOLD_MINUTES || sh > SLA_SUPPORT_THRESHOLD_HOURS;
    }).length;
    const slaCompliantCount = total - slaBreachCount;
    const slaBreachRate = ((slaBreachCount / total) * 100).toFixed(1);

    // ── NEW KPI 4: Team Workload Distribution ──────────────────────────────────
    const workloadMap: Record<string, number> = {};
    filtered.forEach(issue => {
      const assignees: string[] = issue.assigneeUsernames || [];
      const reporter = (issue.reporterUsername || "").toLowerCase();

      let attributed = false;
      assignees.forEach((a: string) => {
        const al = a.toLowerCase();
        if (teamLower.includes(al)) {
          workloadMap[al] = (workloadMap[al] || 0) + 1;
          attributed = true;
        }
      });
      if (!attributed && teamLower.includes(reporter)) {
        workloadMap[reporter] = (workloadMap[reporter] || 0) + 1;
      }
    });

    const workloadData = TEAM_MEMBERS
      .map((m, idx) => ({
        name: m,
        shortName: m.length > 12 ? m.substring(0, 10) + '…' : m,
        tickets: workloadMap[m.toLowerCase()] || 0,
        color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
      }))
      .filter(m => m.tickets > 0)
      .sort((a, b) => b.tickets - a.tickets);

    // ── NEW KPI 5: Client Type Breakdown ──────────────────────────────────────
    const clientTypeMap: Record<string, number> = {};
    filtered.forEach(issue => {
      const ct = (issue.clientType || "Unknown").trim() || "Unknown";
      clientTypeMap[ct] = (clientTypeMap[ct] || 0) + 1;
    });

    const CLIENT_COLORS = ['hsl(var(--primary))', '#a855f7', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#64748b'];
    const clientTypeData = Object.entries(clientTypeMap)
      .map(([name, value], idx) => ({
        name,
        value,
        pct: parseFloat(((value / total) * 100).toFixed(1)),
        color: CLIENT_COLORS[idx % CLIENT_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);

    // ── NEW KPI 6: Escalation Rate ─────────────────────────────────────────────
    // Escalated = has L2 label OR status is 'Dhaka Team (L2)'
    const escalatedCount = filtered.filter(i => {
      const hasL2Label = i.labelNames?.some((l: string) => l.toUpperCase() === 'L2') || false;
      const hasL2Status = i.customStatus === 'Dhaka Team (L2)';
      return hasL2Label || hasL2Status;
    }).length;
    const nonEscalatedCount = total - escalatedCount;
    const escalationRate = ((escalatedCount / total) * 100).toFixed(1);

    return {
      total, fcr, art, mttr, chartData,
      longestOpen, highestSupport, highestResolution, lowestResolution, unmanagedTickets,
      resolutionRate, closedCount, openCount,
      memberHours,
      slaBreachRate, slaBreachCount, slaCompliantCount,
      workloadData,
      clientTypeData,
      escalationRate, escalatedCount, nonEscalatedCount,
    };
  }, [rawIssues, selectedMonth, selectedYear]);

  // 2. EARLY RETURN AFTER ALL HOOKS
  if (isLoading || !user || selectedMonth === "") {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  const resolutionRateNum = parseFloat(stats.resolutionRate);
  const slaBreachRateNum = parseFloat(stats.slaBreachRate);
  const escalationRateNum = parseFloat(stats.escalationRate);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Calculator className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Performance Metrics</h2>
        </div>
        <p className="text-muted-foreground">Enterprise KPI analysis for Dhaka Team &amp; Observations.</p>
      </div>

      {/* ── Period Selector ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-muted/30">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-2">
              <CalendarIcon className="h-3 w-3" /> Report Period
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="bg-background h-9">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="bg-background h-9">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
          <CardContent className="p-0 text-center">
            <p className="text-xs font-bold uppercase opacity-80 mb-1">
              {MONTHS[parseInt(selectedMonth)]?.label || "Selected"} Scope
            </p>
            <div className="text-4xl font-black">{stats.total}</div>
            <p className="text-[10px] uppercase font-medium opacity-60">Total Tickets Managed</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Existing KPI Cards ── */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm border-primary/20 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground flex items-center justify-between">
              FCR Rate
              <Target className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats.fcr}%</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">First Contact Resolution</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-secondary/20 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground flex items-center justify-between">
              Avg Response
              <Clock className="h-4 w-4 text-secondary-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary-foreground">{stats.art}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">Σ(ResponseTime) / Total Tickets</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-purple-100 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground flex items-center justify-between">
              Mean Support
              <Zap className="h-4 w-4 text-purple-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.mttr}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">Σ(SupportHours) / Total Tickets</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Outlier Cards ── */}
      <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" /> Longest Open Ticket
              </CardTitle>
              <CardDescription>Scope: Label L2 + Status Dhaka Team (L2)</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.longestOpen ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold leading-tight">{stats.longestOpen.title}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">#{stats.longestOpen.githubIssueNumber}</p>
                    </div>
                    <Badge variant="outline" className="bg-white text-amber-700 border-amber-200 whitespace-nowrap">
                      {stats.longestOpen.durationDays} Days
                    </Badge>
                  </div>
                  <a href={stats.longestOpen.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary font-bold flex items-center gap-1 hover:underline">
                    VIEW ON GITHUB <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 italic">No L2 records found for this period.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50/30">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-purple-700">
                <Trophy className="h-4 w-4" /> Highest Support Hours
              </CardTitle>
              <CardDescription>Scope: Label L2 + Status Dhaka Team (L2)</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.highestSupport ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold leading-tight">{stats.highestSupport.title}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">#{stats.highestSupport.githubIssueNumber}</p>
                    </div>
                    <Badge variant="outline" className="bg-white text-purple-700 border-purple-200 whitespace-nowrap">
                      {stats.highestSupport.totalHours} Hours
                    </Badge>
                  </div>
                  <a href={stats.highestSupport.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary font-bold flex items-center gap-1 hover:underline">
                    VIEW ON GITHUB <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 italic">No L2 records found for this period.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-green-700">
                <Zap className="h-4 w-4" /> Highest Resolution Time
              </CardTitle>
              <CardDescription>Scope: Label L2 + Status Dhaka Team (L2) · Closed tickets only</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.highestResolution ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold leading-tight">{stats.highestResolution.title}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">#{stats.highestResolution.githubIssueNumber}</p>
                    </div>
                    <Badge variant="outline" className="bg-white text-green-700 border-green-200 whitespace-nowrap">
                      {stats.highestResolution.resolutionDays} Days
                    </Badge>
                  </div>
                  <a href={stats.highestResolution.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary font-bold flex items-center gap-1 hover:underline">
                    VIEW ON GITHUB <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 italic">No closed L2 records found for this period.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-sky-200 bg-sky-50/30">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-sky-700">
                <Trophy className="h-4 w-4" /> Lowest Resolution Time
              </CardTitle>
              <CardDescription>Scope: Label L2 + Status Dhaka Team (L2) · Closed tickets only</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.lowestResolution ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold leading-tight">{stats.lowestResolution.title}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">#{stats.lowestResolution.githubIssueNumber}</p>
                    </div>
                    <Badge variant="outline" className="bg-white text-sky-700 border-sky-200 whitespace-nowrap">
                      {stats.lowestResolution.resolutionDays} Days
                    </Badge>
                  </div>
                  <a href={stats.lowestResolution.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary font-bold flex items-center gap-1 hover:underline">
                    VIEW ON GITHUB <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 italic">No closed L2 records found for this period.</p>
              )}
            </CardContent>
          </Card>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          NEW KPI SECTION DIVIDER
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-4 pt-4">
        <div className="h-px flex-1 bg-border" />
        <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 border border-primary/20 rounded-full">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Extended KPIs</span>
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* ── NEW KPI 1 + 3: Resolution Rate & SLA Breach ── */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* KPI 1: Ticket Resolution Rate */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-emerald-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center justify-between text-emerald-700">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Ticket Resolution Rate
              </span>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold">
                {stats.resolutionRate}%
              </Badge>
            </CardTitle>
            <CardDescription>% of tickets closed vs total in period</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Progress value={parseFloat(stats.resolutionRate)} className="h-3 bg-muted" />
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border border rounded-lg overflow-hidden bg-muted/20">
              <div className="p-3 text-center">
                <div className="text-xl font-black text-foreground">{stats.total}</div>
                <div className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">Total</div>
              </div>
              <div className="p-3 text-center">
                <div className="text-xl font-black text-emerald-600">{stats.closedCount}</div>
                <div className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">Closed</div>
              </div>
              <div className="p-3 text-center">
                <div className="text-xl font-black text-amber-600">{stats.openCount}</div>
                <div className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">Open</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {resolutionRateNum >= 70
                ? <TrendingUp className="h-3 w-3 text-emerald-500" />
                : <TrendingDown className="h-3 w-3 text-destructive" />
              }
              <span>
                {resolutionRateNum >= 70
                  ? "Resolution rate is healthy (≥70%)"
                  : "Resolution rate is below target (70%)"
                }
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: SLA Breach Rate */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center justify-between text-red-700">
              <span className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                SLA Breach Rate
              </span>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs font-bold">
                {stats.slaBreachRate}%
              </Badge>
            </CardTitle>
            <CardDescription>
              RT &gt; {SLA_RESPONSE_THRESHOLD_MINUTES} min  or  SH &gt; {SLA_SUPPORT_THRESHOLD_HOURS} hrs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {/* Inverted: low breach = good */}
              <Progress
                value={slaBreachRateNum}
                className="h-3 bg-muted [&>div]:bg-red-500"
              />
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                <span>0% breach</span>
                <span>100% breach</span>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border border rounded-lg overflow-hidden bg-muted/20">
              <div className="p-3 text-center">
                <div className="text-xl font-black text-foreground">{stats.total}</div>
                <div className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">Total</div>
              </div>
              <div className="p-3 text-center">
                <div className="text-xl font-black text-red-600">{stats.slaBreachCount}</div>
                <div className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">Breached</div>
              </div>
              <div className="p-3 text-center">
                <div className="text-xl font-black text-emerald-600">{stats.slaCompliantCount}</div>
                <div className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">Compliant</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {slaBreachRateNum <= 20
                ? <TrendingDown className="h-3 w-3 text-emerald-500" />
                : <TrendingUp className="h-3 w-3 text-destructive" />
              }
              <span>
                {slaBreachRateNum <= 20
                  ? "SLA breaches within acceptable range (≤20%)"
                  : "SLA breach rate is above target — review thresholds"
                }
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── NEW KPI 6: Escalation Rate ── */}
      <Card className="shadow-sm hover:shadow-md transition-shadow border-orange-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center justify-between text-orange-700">
            <span className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              Escalation Rate
            </span>
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs font-bold">
              {stats.escalationRate}%
            </Badge>
          </CardTitle>
          <CardDescription>Tickets escalated to L2 (Label L2 or Status "Dhaka Team (L2)")</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Donut */}
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={[
                      { name: 'Escalated', value: stats.escalatedCount, fill: '#f97316' },
                      { name: 'Non-Escalated', value: stats.nonEscalatedCount, fill: '#e5e7eb' },
                    ]}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  />
                  <Tooltip formatter={(value, name) => [value, name]} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>

            {/* Stats */}
            <div className="md:col-span-2 grid grid-cols-3 divide-x divide-border border rounded-lg overflow-hidden bg-muted/20">
              <div className="p-4 text-center">
                <div className="text-2xl font-black text-foreground">{stats.total}</div>
                <div className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">Total</div>
              </div>
              <div className="p-4 text-center">
                <div className="text-2xl font-black text-orange-600">{stats.escalatedCount}</div>
                <div className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">Escalated (L2)</div>
              </div>
              <div className="p-4 text-center">
                <div className="text-2xl font-black text-slate-500">{stats.nonEscalatedCount}</div>
                <div className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">Non-Escalated</div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
            {escalationRateNum <= 30
              ? <TrendingDown className="h-3 w-3 text-emerald-500" />
              : <TrendingUp className="h-3 w-3 text-destructive" />
            }
            <span>
              {escalationRateNum <= 30
                ? "Escalation rate is within healthy range (≤30%)"
                : "Escalation rate is elevated — consider L1 training or process review"
              }
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── NEW KPI 4: Team Workload Distribution ── */}
      <Card className="shadow-sm hover:shadow-md transition-shadow border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-700">
            <Users className="h-4 w-4" />
            Team Workload Distribution
          </CardTitle>
          <CardDescription>Tickets attributed per team member (by assignee, fallback to reporter)</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.workloadData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Bar chart */}
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.workloadData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                    <XAxis type="number" allowDecimals={false} fontSize={10} />
                    <YAxis dataKey="shortName" type="category" axisLine={false} tickLine={false} fontSize={9} width={90} />
                    <Tooltip formatter={(v) => [`${v} tickets`, 'Workload']} />
                    <Bar dataKey="tickets" radius={[0, 4, 4, 0]} barSize={20}>
                      {stats.workloadData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Ranked list */}
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
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: m.color }} />
                        </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground w-8 text-right font-bold">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8 italic">No workload data available for this period.</p>
          )}
        </CardContent>
      </Card>

      {/* ── NEW KPI 2 + 5: Member Avg Hours & Client Type ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* KPI 2: Avg Support Hours per Member */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-violet-200">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-violet-700">
              <Clock className="h-4 w-4" />
              Avg Support Hours / Member
            </CardTitle>
            <CardDescription>Total support hours and average per ticket, grouped by team member</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.memberHours.length > 0 ? (
              <div className="space-y-3">
                {stats.memberHours.map((m, idx) => (
                  <div key={m.name} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                        <span className="font-bold">{m.name}</span>
                        <span className="text-muted-foreground">({m.tickets} ticket{m.tickets !== 1 ? 's' : ''})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-[10px]">{m.hours.toFixed(1)} total hrs</span>
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 font-bold"
                          style={{ color: m.color, borderColor: m.color + '40', background: m.color + '10' }}
                        >
                          {m.avgHours} avg
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${stats.memberHours[0]?.avgHours > 0 ? Math.min((m.avgHours / stats.memberHours[0].avgHours) * 100, 100) : 0}%`,
                          background: m.color
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8 italic">No member support data for this period.</p>
            )}
          </CardContent>
        </Card>

        {/* KPI 5: Client Type Breakdown */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-teal-200">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-teal-700">
              <PieChart className="h-4 w-4" />
              Client Type Breakdown
            </CardTitle>
            <CardDescription>Ticket volume distribution by client type</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.clientTypeData.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={stats.clientTypeData}
                        cx="50%" cy="50%"
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, pct }) => `${name} (${pct}%)`}
                        labelLine={false}
                      >
                        {stats.clientTypeData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${value} tickets`, name]} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  {stats.clientTypeData.map((ct) => (
                    <div key={ct.name} className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: ct.color }} />
                      <span className="text-[11px] font-bold flex-1 truncate">{ct.name}</span>
                      <span className="text-[11px] text-muted-foreground">{ct.value} tickets</span>
                      <Badge variant="outline" className="text-[9px] h-4 font-bold" style={{ color: ct.color, borderColor: ct.color + '40' }}>
                        {ct.pct}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8 italic">No client type data for this period.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Unmanaged Tickets (existing) ── */}
      <Card className="border-none shadow-md overflow-hidden bg-card">
        <CardHeader className="bg-destructive/5 border-b border-destructive/10">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" /> Unmanaged Tickets
          </CardTitle>
          <CardDescription>
            Closed tickets missing critical data (RT, SH, FCR, or Closer Actor).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[100px]"><Hash className="h-3 w-3 inline mr-1" /> No.</TableHead>
                <TableHead>Ticket Summary</TableHead>
                <TableHead>Missing Field(s)</TableHead>
                <TableHead><User className="h-3 w-3 inline mr-1" /> Closed By</TableHead>
                <TableHead className="text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.unmanagedTickets.length > 0 ? (
                stats.unmanagedTickets.map((ticket) => (
                  <TableRow key={ticket.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-xs opacity-60">#{ticket.githubIssueNumber}</TableCell>
                    <TableCell className="font-bold text-sm max-w-[300px] truncate">{ticket.title}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(parseFloat(ticket.responseTimeMinutes) === 0 || isNaN(parseFloat(ticket.responseTimeMinutes))) && (
                          <Badge variant="outline" className="text-[8px] h-4 bg-red-50 text-red-600 border-red-100">RT Missing</Badge>
                        )}
                        {(parseFloat(ticket.supportHours) === 0 || isNaN(parseFloat(ticket.supportHours))) && (
                          <Badge variant="outline" className="text-[8px] h-4 bg-orange-50 text-orange-600 border-orange-100">SH Missing</Badge>
                        )}
                        {(!ticket.fcr || ticket.fcr === "") && (
                          <Badge variant="outline" className="text-[8px] h-4 bg-amber-50 text-amber-600 border-amber-100">FCR Missing</Badge>
                        )}
                        {(!ticket.closedBy || ticket.closedBy === "") && (
                          <Badge variant="outline" className="text-[8px] h-4 bg-gray-50 text-gray-600 border-gray-100">Closer Missing</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      {ticket.closedBy || <span className="text-muted-foreground italic opacity-50">Not Captured</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <a href={ticket.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted text-primary">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                    All closed tickets in this period are fully managed.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
