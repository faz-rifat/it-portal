
import { PortalShell } from '@/components/layout/portal-shell';

export default function ConnectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
