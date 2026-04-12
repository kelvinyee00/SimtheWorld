"use client";

import { useState } from "react";
import { createClient } from "@/src/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setError("Check your email for the confirmation link.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
            Web Simulink
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-800">Welcome Back</h1>
        </div>

        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="operator@matrix.net"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-600 border border-rose-100">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:bg-slate-400"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:bg-slate-100"
            >
              Create Account
            </button>
          </div>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-slate-500 hover:text-indigo-600 hover:underline"
          >
            ← Back to Editor (Guest Mode)
          </button>
        </div>
      </div>
    </div>
  );
}
