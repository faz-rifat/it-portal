"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Github, Link2, AlertCircle } from 'lucide-react';

const CONNECTED_PROJECTS = [
  { number: 181, name: "Service Desk", description: "SELISE Digital Platforms Board" },
  { number: 358, name: "Workhub",      description: "Workhub Project Board" },
  { number: 305, name: "Techsupport",  description: "IT Support Project Board" },
];

export default function ConnectPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight text-primary">GitHub Integration</h2>
        <p className="text-muted-foreground">Manage your connection to the SELISE organization and projects.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Connected Repositories
            </CardTitle>
            <CardDescription>Currently syncing from SELISEdigitalplatforms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {CONNECTED_PROJECTS.map((project) => (
              <div
                key={project.number}
                className="flex items-center justify-between p-4 bg-card rounded-lg border"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Project {project.number} — {project.name}</span>
                  <span className="text-xs text-muted-foreground">{project.description}</span>
                </div>
                <Button size="sm" variant="outline" className="gap-2">
                  <Link2 className="h-4 w-4" /> Disconnect
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1">
              Last successful sync: {new Date().toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Sync Status
            </CardTitle>
            <CardDescription>Real-time monitoring of GitHub Webhooks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium">GraphQL API: Healthy</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium">Webhook Listener: Active</span>
              </div>
              <Button className="w-full mt-4" variant="secondary">Run Health Check</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
