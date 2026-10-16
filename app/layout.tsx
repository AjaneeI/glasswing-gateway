import { GatewayProvider } from '@/components/gateway/provider';
import { AppProvider } from '@/components/layout/app-provider';
import { AppShell } from '@/components/layout/app-shell';
import type { Metadata } from 'next';
import './globals.css';
import './workspace.css';
export const metadata: Metadata = {
  title: { default: 'Gateway — Agent Commerce Infrastructure', template: '%s · Gateway' },
  description:
    'Test, observe, and secure autonomous shopping experiences. Agent-native commerce infrastructure for Evertrail Outdoors.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <GatewayProvider>
          <AppProvider>
            <AppShell>{children}</AppShell>
          </AppProvider>
        </GatewayProvider>
      </body>
    </html>
  );
}
