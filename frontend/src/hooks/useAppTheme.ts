import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { resolveTheme, THEME_META, type AppTheme } from "@/lib/branding";

export function useAppTheme(): AppTheme {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const theme = resolveTheme({ role: user?.role, chain: user?.store.chain, pathname });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.title = THEME_META[theme].documentTitle;
  }, [theme]);

  return theme;
}
