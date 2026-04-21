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
  BarChart3,
  Loader2,
  Calendar as CalendarIcon,
  Trophy,
  AlertTriangle,
  ExternalLink,
  AlertCircle,
  User,
  Hash
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
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
    if (!rawIssues || selectedMonth === "" || selectedYear === "") return { 
      total: 0, 
      fcr: "0.0", 
      art: "0.0", 
      mttr: "0.0", 
      chartData: [], 
      longestOpen: null, 
      highestSupport: null,
      unmanagedTickets: [] 
    };

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
    if (total === 0) return { 
      total: 0, 
      fcr: "0.0", 
      art: "0.0", 
      mttr: "0.0", 
      chartData: [], 
      longestOpen: null, 
      highestSupport: null,
      unmanagedTickets: []
    };

    // 1. KPI Metrics (Calculated for the broad scope)
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

    // 2. Unmanaged Tickets Logic
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

    // 3. Strict Outlier Logic (Label L2 AND Status Dhaka Team L2)
    let longestOpen: any = null;
    let maxDays = -1;
    let highestSupport: any = null;
    let maxHours = -1;

    filtered.forEach(issue => {
      const hasL2Label = issue.labelNames?.some((l: string) => l.toUpperCase() === 'L2');
      const hasL2Status = issue.customStatus === 'Dhaka Team (L2)';
      
      // Strict filter for outliers as requested: ONLY Label L2 AND Status Dhaka Team L2
      if (hasL2Label && hasL2Status) {
        const created = new Date(issue.githubCreatedAt);
        const resolved = issue.dateResolved ? new Date(issue.dateResolved) : (issue.status === 'CLOSED' ? new Date(issue.githubUpdatedAt) : new Date());
        const days = differenceInDays(resolved, created);
        if (days > maxDays) {
          maxDays = days;
          longestOpen = { ...issue, durationDays: days };
        }

        const hours = parseFloat(issue.supportHours) || 0;
        if (hours > maxHours) {
          maxHours = hours;
          highestSupport = { ...issue, totalHours: hours };
        }
      }
    });

    const chartData = [
      { name: 'FCR %', value: parseFloat(fcr), color: 'hsl(var(--primary))' },
      { name: 'ART', value: parseFloat(art), color: 'hsl(var(--secondary))' },
      { name: 'MTTR', value: parseFloat(mttr), color: '#a855f7' },
    ];

    return { total, fcr, art, mttr, chartData, longestOpen, highestSupport, unmanagedTickets };
  }, [rawIssues, selectedMonth, selectedYear]);

  // 2. EARLY RETURN AFTER ALL HOOKS
  if (isLoading || !user || selectedMonth === "") {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Calculator className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Performance Metrics</h2>
        </div>
        <p className="text-muted-foreground">Enterprise KPI analysis for Dhaka Team & Observations.</p>
      </div>

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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Efficiency Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={10} width={80} className="font-bold" />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                  {stats.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-6">
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
        </div>
      </div>

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
