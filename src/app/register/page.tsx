"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, UserPlus, ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm) {
      setError("Password tidak cocok.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.username, email: form.email, password: form.password }),
    });
    const data = await res.json() as { error?: string };
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Terjadi kesalahan. Coba lagi.");
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30 mb-2">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Cek Email Anda</h2>
          <p className="text-sm text-slate-400">
            Link verifikasi telah dikirim ke <strong className="text-white">{form.email}</strong>.
            Klik link tersebut untuk mengaktifkan akun Anda.
          </p>
          <Link href="/login" className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300">
            ← Kembali ke halaman login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 mb-4">
            <UserPlus className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Buat Akun</h1>
          <p className="text-sm text-slate-400 mt-1">Fokus Prioritas 20 Branch</p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {(["username", "email", "password", "confirm"] as const).map((field) => (
              <div key={field} className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block capitalize">
                  {field === "confirm" ? "Konfirmasi Password" : field === "username" ? "Username" : field === "email" ? "Email" : "Password"}
                </label>
                <input
                  type={field === "password" || field === "confirm" ? "password" : field === "email" ? "email" : "text"}
                  value={form[field]}
                  onChange={set(field)}
                  required
                  autoComplete={field === "confirm" ? "new-password" : field}
                  placeholder={field === "confirm" ? "Ulangi password" : `Masukkan ${field}`}
                  className="w-full px-3 py-2.5 text-sm rounded-lg bg-white/10 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            ))}

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {loading ? "Memproses..." : "Daftar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-blue-400 hover:text-blue-300">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
