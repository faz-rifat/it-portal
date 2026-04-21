
import { PortalShell } from '@/components/layout/portal-shell';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
