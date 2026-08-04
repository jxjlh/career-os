import { AppShell } from "@/components/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { AuthGuard } from "@/components/auth-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthGuard>
        <AppShell>{children}</AppShell>
      </AuthGuard>
    </ErrorBoundary>
  );
}
