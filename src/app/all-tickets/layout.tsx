import { PortalShell } from '@/components/layout/portal-shell';

export default function AllTicketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
