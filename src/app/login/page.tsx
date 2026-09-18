"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error === "EMAIL_NOT_VERIFIED") {
        setError("Email belum diverifikasi. Cek inbox Anda.");
      } else if (result.error === "ACCOUNT_DISABLED") {
        setError("Akun Anda dinonaktifkan. Hubungi administrator.");
      } else {
        setError("Username atau password salah.");
      }
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Fokus Prioritas 20 Branch
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Masuk untuk mengakses dashboard
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                placeholder="Masukkan username"
                className="w-full px-3 py-2.5 text-sm rounded-lg bg-white/10 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="Masukkan password"
                className="w-full px-3 py-2.5 text-sm rounded-lg bg-white/10 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Belum punya akun?{" "}
          <Link href="/register" className="text-blue-400 hover:text-blue-300">
            Daftar
          </Link>
        </p>
        <p className="text-center text-[11px] text-slate-600 mt-2">
          Telkom Indonesia · TREG 3
        </p>
      </div>
    </div>
  );
}
