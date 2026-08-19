import { AuthProvider } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AppShell>
    </AuthProvider>
  )
}
