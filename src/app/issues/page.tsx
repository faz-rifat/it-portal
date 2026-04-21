"use client"

import { GitHubIssuesList } from '@/components/github-issues-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Ticket, Github, Info } from 'lucide-react';

export default function IssuesPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Ticket className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-primary">Git Tickets</h2>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Track, filter, and summarize tickets synchronized from linked GitHub repositories. Use the AI Summarizer to quickly digest complex issue reports.
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/50 px-3 py-2 rounded-full border">
          <Github className="h-3 w-3" />
          Linked: Project 181
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0">
            <CardTitle>Enterprise Ticket Tracker</CardTitle>
            <CardDescription>Comprehensive list of all open and closed tickets for the Dhaka Team.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <GitHubIssuesList />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-primary/5 border-primary/10">
        <CardContent className="flex items-start gap-4 p-6">
          <div className="mt-1">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-primary">Automated Reporting</p>
            <p className="text-sm text-muted-foreground">
              These tickets are automatically fetched via the GitHub integration. You can configure synchronization frequency and repo settings in the <a href="#" className="font-semibold text-primary underline">Settings</a> panel.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
