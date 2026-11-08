import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { useAuth } from "@/context/AuthContext";

export function LoginPage() {
  const { user, login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = "login";
    document.title = "Ivory Lace · Kalsankar OS · Admin Portal";
  }, []);

  if (!isLoading && user) {
    return <Navigate to={user.role === "SUPER_ADMIN" ? "/admin/stores" : "/inventory/stock-overview"} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to login");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-white p-8 shadow-2xl">
        <div className="text-center">
          <h1 className="text-xl font-bold text-ink-900">Sign in</h1>
          <p className="mt-1 text-sm text-ink-500">Store management for three applications</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <span className="rounded-full bg-pink-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-700">
              Ivory Lace
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              Kalsankar OS
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
              Admin Portal
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <TextField
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@store.in"
          />
          <TextField
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[11px] text-ink-500">
          Store staff land in their branch app. Super admins open the Admin Portal.
        </p>
      </div>
    </div>
  );
}
