import { Outlet, useMatches } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { THEME_META } from "@/lib/branding";

interface RouteHandle {
  title?: string;
  subtitle?: string;
}

export function AppLayout() {
  const theme = useAppTheme();
  const matches = useMatches();
  const current = [...matches].reverse().find((match) => (match.handle as RouteHandle)?.title);
  const handle = (current?.handle as RouteHandle) ?? {};

  return (
    <div className="flex h-screen bg-brand-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={handle.title ?? THEME_META[theme].wordmark} subtitle={handle.subtitle} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
