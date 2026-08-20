import { AuthProvider } from '@/lib/auth'
import { ConnectionProvider } from '@/lib/connection'
import AppShell from '@/components/AppShell'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConnectionProvider>
        <AppShell>
          <ErrorBoundary>{children}</ErrorBoundary>
        </AppShell>
      </ConnectionProvider>
    </AuthProvider>
  )
}
