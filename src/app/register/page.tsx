"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, UserPlus, ShieldCheck } from "lucide-react";
import { VALID_COMPANIES } from "@/lib/companies";
import Image from "next/image";
export default function RegisterPage() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    company: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/register", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { enabled?: boolean }) =>
        setRegistrationEnabled(payload.enabled === true)
      )
      .catch(() => setRegistrationEnabled(false));
  }, []);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.company) {
      setError("Silakan pilih perusahaan.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Password tidak cocok.");
      return;
    }
    if (form.password.length < 12) {
      setError("Password minimal 12 karakter.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.username,
        email: form.email,
        company: form.company,
        password: form.password,
      }),
    });
    const data = await res.json() as { error?: string };
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Terjadi kesalahan. Coba lagi.");
      return;
    }
    setSuccess(true);
  };

  if (registrationEnabled === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!registrationEnabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 mx-auto mb-1">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-lg font-bold text-slate-800">Pendaftaran Dinonaktifkan</h1>
            <p className="text-sm text-slate-500">
              Hubungi administrator untuk membuat akun dashboard.
            </p>
            <Link href="/login" className="inline-block pt-2 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline">
              ← Kembali ke halaman login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto mb-1">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Cek Email Anda</h2>
            <p className="text-sm text-slate-600">
              Link verifikasi telah dikirim ke <strong className="text-slate-800 font-semibold">{form.email}</strong>.
              Klik link tersebut untuk mengaktifkan akun Anda.
            </p>
            <Link href="/login" className="inline-block pt-2 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline">
              ← Kembali ke halaman login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700/50 shadow-lg shadow-slate-900/20 mb-4 overflow-hidden p-1.5">
            <Image src="/logo.png" alt="TDSC Logo" width={48} height={48} className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Buat Akun</h1>
          <p className="text-sm text-slate-500 mt-1">TDSC Dashboard</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Username
              </label>
              <input
                type="text"
                value={form.username}
                onChange={set("username")}
                required
                placeholder="Masukkan username"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                required
                placeholder="Masukkan email"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Perusahaan
              </label>
              <select
                value={form.company}
                onChange={set("company")}
                required
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                  form.company ? "text-slate-800" : "text-slate-400"
                }`}
              >
                <option value="" disabled>
                  Pilih Perusahaan...
                </option>
                {VALID_COMPANIES.map((company) => (
                  <option key={company} value={company} className="text-slate-800 bg-white">
                    {company}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                required
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
                placeholder="Minimal 12 karakter"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">
                Konfirmasi Password
              </label>
              <input
                type="password"
                value={form.confirm}
                onChange={set("confirm")}
                required
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
                placeholder="Ulangi password"
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
                <UserPlus className="w-4 h-4" />
              )}
              {loading ? "Memproses..." : "Daftar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-5">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
