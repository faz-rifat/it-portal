
import { PortalShell } from '@/components/layout/portal-shell';

export default function KPILayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
