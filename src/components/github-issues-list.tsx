"use client"

import { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Search, 
  FileText, 
  Loader2,
  ExternalLink,
  Download,
  RefreshCw,
  ShieldAlert,
  MessageSquare,
  History
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { fetchGitHubIssuesAction } from '@/app/actions/github-sync';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const TEAM_MEMBERS = [
  "faz-rifat",
  "emon-selise",
  "SaimunSelise",
  "Amir-Ahammed-SG",
  "zzsabit",
  "fahim-selise"
];

export function GitHubIssuesList() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const issuesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'enterprise-projects', 'github-project-181', 'issues'),
      orderBy('githubCreatedAt', 'desc')
    );
  }, [db, user]);

  const { data: issues, isLoading } = useCollection(issuesQuery);

  const filteredIssues = (issues || []).filter(issue => {
    const titleMatch = issue.title?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    const descMatch = issue.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    const matchesSearch = titleMatch || descMatch;
    
    let matchesDate = true;
    try {
      const issueDate = new Date(issue.githubCreatedAt);
      matchesDate = isWithinInterval(issueDate, {
        start: startOfDay(new Date(startDate)),
        end: endOfDay(new Date(endDate))
      });
    } catch (e) {
      matchesDate = true;
    }

    const lowerCaseTeam = TEAM_MEMBERS.map(m => m.toLowerCase());
    const isTeamAuthor = lowerCaseTeam.includes(issue.reporterUsername?.toLowerCase() || "");
    const isL2Status = issue.customStatus === 'Dhaka Team (L2)';
    const isObservingStatus = issue.customStatus === 'Under Observation (L2)';
    const isL2Label = issue.labelNames?.some((l: string) => l.toUpperCase() === 'L2') || false;

    return matchesSearch && matchesDate && (isTeamAuthor || isL2Status || isObservingStatus || isL2Label);
  });

  const handleSync = async () => {
    if (!db || !user) {
      toast({ title: "Session Error", description: "Authentication required to sync data.", variant: "destructive" });
      return;
    }

    setSyncing(true);
    try {
      const result = await fetchGitHubIssuesAction();
      if (!result.success) throw new Error(result.error);

      const items = result.items || [];
      const projectId = 'github-project-181';
      
      const projectRef = doc(db, 'enterprise-projects', projectId);
      setDocumentNonBlocking(projectRef, {
        id: projectId,
        name: "SELISE Digital Platforms Board",
        githubOwner: "SELISEdigitalplatforms",
        githubRepoName: "Project 181",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const issuesCollection = collection(db, 'enterprise-projects', projectId, 'issues');
      let count = 0;

      for (const item of items) {
        if (!item.content || !item.content.number) continue;

        const fieldMap: Record<string, string> = {};
        if (item.fieldValues?.nodes) {
          item.fieldValues.nodes.forEach((val: any) => {
            if (!val?.field?.name) return;
            const fName = val.field.name.toLowerCase().trim();
            let fVal = "";
            
            if (val.text !== undefined && val.text !== null) fVal = val.text;
            else if (val.date !== undefined && val.date !== null) fVal = val.date;
            else if (val.number !== undefined && val.number !== null) fVal = val.number.toString();
            else if (val.name !== undefined && val.name !== null) fVal = val.name;
            else if (val.title !== undefined && val.title !== null) fVal = val.title;
            else if (val.users?.nodes?.[0]?.login) fVal = val.users.nodes[0].login;
            
            if (fVal !== "") {
              fieldMap[fName] = fVal;
            }
          });
        }

        const githubIssueNumber = item.content.number;
        const issueId = `gh-${githubIssueNumber}`;
        const issueRef = doc(issuesCollection, issueId);
        const content = item.content;
        const latestComment = content.comments?.nodes?.[0];

        const getFieldValue = (searchTerms: string[]) => {
          for (const term of searchTerms) {
            const normalizedTerm = term.toLowerCase().trim();
            const val = fieldMap[normalizedTerm];
            if (val !== undefined && val !== null && val !== "") return val;
          }
          return "";
        };

        const rt = getFieldValue(["response time (minutes)", "response time (mins)", "response time", "rt"]);
        const sh = getFieldValue(["support hours", "support hour", "sh", "effort"]);
        const fcrStatus = getFieldValue(["fcr", "fcr status"]);
        const customStatus = getFieldValue(["status", "current status"]);
        
        // Priority capture for Closer
        const closedBy = getFieldValue(["closed by", "closer", "completed by", "closedby", "mark as completed"]);

        setDocumentNonBlocking(issueRef, {
          id: issueId,
          githubIssueNumber,
          title: content.title || "No Title",
          description: content.body || "",
          status: content.state || "UNKNOWN",
          url: content.url || "",
          reporterUsername: content.author?.login || "unknown",
          assigneeUsernames: content.assignees?.nodes?.map((n: any) => n.login) || [],
          closedBy: closedBy || (content.closed ? "GitHub System" : ""), // Fallback only if item is truly closed
          labelNames: content.labels?.nodes?.map((n: any) => n.name) || [],
          projectId,
          githubCreatedAt: item.createdAt || new Date().toISOString(),
          githubUpdatedAt: content.updatedAt || new Date().toISOString(),
          lastFetchedAt: new Date().toISOString(),
          dateReported: getFieldValue(["date reported", "reported at"]),
          dateResolved: getFieldValue(["date resolved", "resolved at", "completion date"]),
          clientType: getFieldValue(["client type", "client"]),
          supportHours: sh || "0",
          responseTimeMinutes: rt || "0",
          fcr: fcrStatus || "",
          customStatus: customStatus || "",
          latestCommentBody: latestComment?.body || "",
          latestCommentAuthor: latestComment?.author?.login || "",
          latestCommentAt: latestComment?.createdAt || "",
          contentType: content.__typename || "Issue"
        }, { merge: true });

        count++;
      }

      toast({
        title: "Sync Success",
        description: `Refreshed ${count} records with accurate closure tracking.`,
      });
    } catch (error: any) {
      toast({
        title: "Sync Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = () => {
    const header = ["Ticket #", "Title", "Status", "Reporter", "Closed By", "FCR", "Response Time", "Support Hours"];
    const rows = filteredIssues.map(i => [
      i.githubIssueNumber,
      `"${(i.title || "").replace(/"/g, '""')}"`,
      i.status,
      i.reporterUsername,
      i.closedBy || "N/A",
      i.fcr || "N/A",
      i.responseTimeMinutes || "0",
      i.supportHours || "0"
    ]);

    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `enterprise_tickets_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 bg-card p-6 rounded-xl border border-border/50 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Display Window: From</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Display Window: To</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Search Enterprise List</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search tickets..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
            <ShieldAlert className="h-3 w-3 text-primary" />
            Logic: Dhaka L2 + Under Observation
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSync} disabled={syncing} className="gap-2">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Project 181
            </Button>
            <Button onClick={handleExport} disabled={filteredIssues.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[100px]">Ticket</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || !user ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-20" />
                </TableCell>
              </TableRow>
            ) : filteredIssues.length > 0 ? (
              filteredIssues.map((issue) => (
                <TableRow key={issue.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">#{issue.githubIssueNumber}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm leading-tight">{issue.title}</span>
                        {issue.contentType === 'PullRequest' && (
                          <Badge variant="outline" className="text-[8px] h-3.5 bg-blue-50 text-blue-600 border-blue-100">PR</Badge>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        {issue.customStatus === 'Dhaka Team (L2)' && (
                          <Badge className="bg-purple-600 text-[9px] h-4 uppercase font-bold text-white">L2 Managed</Badge>
                        )}
                        {issue.customStatus === 'Under Observation (L2)' && (
                          <Badge className="bg-orange-600 text-[9px] h-4 uppercase font-bold text-white">Observing</Badge>
                        )}
                        {issue.fcr?.toLowerCase() === 'yes' && (
                          <Badge variant="outline" className="text-[9px] h-4 uppercase font-bold text-green-600 border-green-200 bg-green-50">FCR OK</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{issue.reporterUsername}</TableCell>
                  <TableCell>
                    <Badge variant={issue.status === 'OPEN' ? 'default' : 'secondary'} className="text-[9px] uppercase">
                      {issue.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[800px] max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
                        <DialogHeader className="p-6 pb-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono opacity-50">{issue.contentType?.toUpperCase()} #{issue.githubIssueNumber}</span>
                            <a href={issue.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 font-bold hover:underline">
                              OPEN ON GITHUB <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <DialogTitle className="text-xl font-extrabold leading-tight">{issue.title}</DialogTitle>
                        </DialogHeader>

                        <ScrollArea className="flex-1 px-6 pb-6">
                          <div className="space-y-6 pt-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-xl border">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold opacity-50 uppercase tracking-tighter">Response Time</p>
                                <p className="text-sm font-bold">{issue.responseTimeMinutes || '0'} MIN</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold opacity-50 uppercase tracking-tighter">Support Hours</p>
                                <p className="text-sm font-bold">{issue.supportHours || '0'} H</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold opacity-50 uppercase tracking-tighter">Client Type</p>
                                <p className="text-sm font-bold uppercase">{issue.clientType || 'N/A'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold opacity-50 uppercase tracking-tighter">FCR Status</p>
                                <p className={cn("text-sm font-bold uppercase", issue.fcr?.toLowerCase() === 'yes' ? 'text-green-600' : 'text-primary')}>
                                  {issue.fcr || 'NO'}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-2 px-1">
                                <MessageSquare className="h-4 w-4" /> LATEST GITHUB ACTIVITY
                              </h4>
                              {issue.latestCommentBody ? (
                                <div className="bg-secondary/10 p-5 rounded-xl border border-secondary/30 relative">
                                  <div className="absolute -left-1 top-6 w-1 h-6 bg-secondary rounded-full" />
                                  <div className="space-y-3">
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed font-medium text-foreground/90">
                                      {issue.latestCommentBody}
                                    </p>
                                    <div className="flex items-center justify-between pt-2 border-t border-secondary/20">
                                      <div className="flex items-center gap-2">
                                        <div className="h-5 w-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">
                                          {issue.latestCommentAuthor?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                        <span className="text-[11px] font-bold text-secondary-foreground">{issue.latestCommentAuthor}</span>
                                      </div>
                                      <span className="text-[10px] font-medium opacity-60">
                                        {issue.latestCommentAt ? format(new Date(issue.latestCommentAt), 'MMM d, h:mm a') : 'Recently'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-6 text-center border-2 border-dashed rounded-xl bg-muted/20">
                                  <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-2">
                                    <History className="h-4 w-4 opacity-40" /> No recent comments found on GitHub.
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-2 px-1">
                                <FileText className="h-4 w-4" /> ORIGINAL DESCRIPTION
                              </h4>
                              <div className="bg-muted/10 border rounded-xl p-5">
                                <div className="text-xs whitespace-pre-wrap leading-relaxed opacity-80 font-medium">
                                  {issue.description || "No description provided for this issue."}
                                </div>
                              </div>
                            </div>
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                  No tickets found matching the Dhaka Team criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
