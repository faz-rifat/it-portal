"use client"

import { AllTicketsList } from '@/components/all-tickets-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Github, Info } from 'lucide-react';

export default function AllTicketsPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-primary">Full Project Archive</h2>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            View every item synchronized from Project 181. This view provides an unfiltered log of all tickets, issues, and pull requests across all teams.
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/50 px-3 py-2 rounded-full border">
          <Github className="h-3 w-3" />
          Linked: Project 181 (Raw Data)
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0">
            <CardTitle>Global Ticket Directory</CardTitle>
            <CardDescription>A complete, unfiltered record of all project activity stored in the local database.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <AllTicketsList />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-primary/5 border-primary/10">
        <CardContent className="flex items-start gap-4 p-6">
          <div className="mt-1">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-primary">Data Integrity</p>
            <p className="text-sm text-muted-foreground">
              This list reflects the raw data stored in Firestore. To fetch the latest changes from GitHub, use the <strong>Sync Project 181</strong> button above. Exported CSVs will include all metadata fields and direct links to GitHub.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
