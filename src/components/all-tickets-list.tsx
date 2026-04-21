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
  Calendar,
  MessageSquare
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { fetchGitHubIssuesAction } from '@/app/actions/github-sync';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function AllTicketsList() {
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
    // 1. Search Filter
    const titleMatch = issue.title?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    const descMatch = issue.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    const matchesSearch = titleMatch || descMatch;
    
    // 2. Date Range Filter
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

    // 3. NO TEAM FILTERING AS REQUESTED
    return matchesSearch && matchesDate;
  });

  const handleSync = async () => {
    if (!db || !user) return;
    setSyncing(true);
    try {
      const result = await fetchGitHubIssuesAction();
      if (!result.success) throw new Error(result.error);

      const items = result.items || [];
      const projectId = 'github-project-181';
      
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
            if (fVal !== "") fieldMap[fName] = fVal;
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

        setDocumentNonBlocking(issueRef, {
          id: issueId,
          githubIssueNumber,
          title: content.title || "No Title",
          description: content.body || "",
          status: content.state || "UNKNOWN",
          url: content.url || "",
          reporterUsername: content.author?.login || "unknown",
          assigneeUsernames: content.assignees?.nodes?.map((n: any) => n.login) || [],
          closedBy: getFieldValue(["closed by", "closer", "completed by"]),
          labelNames: content.labels?.nodes?.map((n: any) => n.name) || [],
          projectId,
          githubCreatedAt: item.createdAt || new Date().toISOString(),
          githubUpdatedAt: content.updatedAt || new Date().toISOString(),
          lastFetchedAt: new Date().toISOString(),
          supportHours: getFieldValue(["support hours", "sh", "effort"]) || "0",
          responseTimeMinutes: getFieldValue(["response time (minutes)", "rt"]) || "0",
          fcr: getFieldValue(["fcr", "fcr status"]) || "",
          customStatus: getFieldValue(["status", "current status"]) || "",
          latestCommentBody: latestComment?.body || "",
          latestCommentAuthor: latestComment?.author?.login || "",
          latestCommentAt: latestComment?.createdAt || "",
          contentType: content.__typename || "Issue"
        }, { merge: true });

        count++;
      }

      toast({ title: "Sync Complete", description: `Updated ${count} items.` });
    } catch (error: any) {
      toast({ title: "Sync Error", description: error.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = () => {
    const header = ["Ticket #", "Title", "Date Created", "Status", "Reporter", "Closed By", "FCR", "RT (Min)", "SH (Hrs)", "GitHub URL"];
    const rows = filteredIssues.map(i => [
      i.githubIssueNumber,
      `"${(i.title || "").replace(/"/g, '""')}"`,
      format(new Date(i.githubCreatedAt), 'yyyy-MM-dd HH:mm'),
      i.status,
      i.reporterUsername,
      i.closedBy || "N/A",
      i.fcr || "N/A",
      i.responseTimeMinutes || "0",
      i.supportHours || "0",
      i.url
    ]);

    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `all_project_tickets_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 bg-card p-6 rounded-xl border border-border/50 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Start Date
            </label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Calendar className="h-3 w-3" /> End Date
            </label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="lg:col-span-2 space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Search className="h-3 w-3" /> Search Global Directory
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by title or description..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between pt-4 border-t">
          <p className="text-xs text-muted-foreground font-medium">
            Showing <span className="font-bold text-primary">{filteredIssues.length}</span> items in selected range.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSync} disabled={syncing} className="gap-2">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync Project
            </Button>
            <Button onClick={handleExport} disabled={filteredIssues.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              Export Global CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[100px]">No.</TableHead>
              <TableHead>Ticket Details</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Date Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || !user ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-20" />
                </TableCell>
              </TableRow>
            ) : filteredIssues.length > 0 ? (
              filteredIssues.map((issue) => (
                <TableRow key={issue.id} className="hover:bg-muted/30 transition-colors group">
                  <TableCell className="font-mono text-xs text-muted-foreground">#{issue.githubIssueNumber}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm leading-tight group-hover:text-primary transition-colors">
                          {issue.title}
                        </span>
                        {issue.contentType === 'PullRequest' && (
                          <Badge variant="outline" className="text-[8px] h-3.5 bg-blue-50 text-blue-600 border-blue-100">PR</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {issue.labelNames?.slice(0, 3).map((label: string) => (
                          <span key={label} className="text-[9px] bg-muted px-1.5 py-0.5 rounded border font-medium">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{issue.reporterUsername}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(issue.githubCreatedAt), 'MMM d, yyyy')}
                  </TableCell>
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
                      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                        <DialogHeader className="p-6 pb-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono opacity-50">{issue.contentType?.toUpperCase()} #{issue.githubIssueNumber}</span>
                            <a href={issue.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 font-bold hover:underline">
                              VIEW ON GITHUB <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <DialogTitle className="text-xl font-black leading-tight">{issue.title}</DialogTitle>
                        </DialogHeader>

                        <ScrollArea className="flex-1 px-6 pb-6">
                          <div className="space-y-6 pt-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-xl border">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold opacity-50 uppercase">Response Time</p>
                                <p className="text-sm font-bold">{issue.responseTimeMinutes || '0'} MIN</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold opacity-50 uppercase">Support Hours</p>
                                <p className="text-sm font-bold">{issue.supportHours || '0'} H</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold opacity-50 uppercase">FCR</p>
                                <p className="text-sm font-bold uppercase">{issue.fcr || 'N/A'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold opacity-50 uppercase">Board Status</p>
                                <p className="text-sm font-bold uppercase truncate">{issue.customStatus || 'NONE'}</p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" /> ACTIVITY LOG
                              </h4>
                              <div className="bg-muted/10 border rounded-xl p-5 space-y-4">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Original Reporter</p>
                                  <p className="text-sm font-semibold">{issue.reporterUsername}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Assigned To</p>
                                  <div className="flex flex-wrap gap-2">
                                    {issue.assigneeUsernames?.length > 0 ? issue.assigneeUsernames.map((u: string) => (
                                      <span key={u} className="text-xs bg-background px-2 py-0.5 rounded border">{u}</span>
                                    )) : <span className="text-xs italic opacity-50">Unassigned</span>}
                                  </div>
                                </div>
                                {issue.closedBy && (
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Closed By</p>
                                    <p className="text-sm font-semibold text-primary">{issue.closedBy}</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                <FileText className="h-4 w-4" /> BODY CONTENT
                              </h4>
                              <div className="bg-muted/5 border rounded-xl p-5">
                                <div className="text-xs whitespace-pre-wrap leading-relaxed opacity-80 font-medium font-mono">
                                  {issue.description || "Empty body content."}
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
                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                  No tickets found in the selected date range.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
