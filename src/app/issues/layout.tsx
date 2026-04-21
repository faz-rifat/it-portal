
import { PortalShell } from '@/components/layout/portal-shell';

export default function IssuesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
