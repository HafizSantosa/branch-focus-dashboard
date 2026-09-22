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
      } else if (result.error === "RATE_LIMITED") {
        setError("Terlalu banyak percobaan login. Coba lagi dalam 15 menit.");
      } else {
        setError("Username atau password salah.");
      }
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20 mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">
            Fokus Prioritas 20 Branch
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Masuk untuk mengakses dashboard
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                placeholder="Masukkan username"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="Masukkan password"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-600/20"
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

        <p className="text-center text-xs text-slate-500 mt-5">
          Belum punya akun?{" "}
          <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
            Daftar
          </Link>
        </p>
      </div>
    </div>
  );
}
