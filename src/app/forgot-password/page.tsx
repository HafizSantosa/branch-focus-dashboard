"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Terjadi kesalahan. Coba lagi.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
      <section className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-7 shadow-sm space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600"><Mail className="w-6 h-6" /></div>
          <h1 className="text-xl font-bold text-slate-800">Lupa password?</h1>
          <p className="text-sm text-slate-500">Masukkan email akun untuk menerima tautan reset password.</p>
        </div>
        {submitted ? (
          <p role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
            Jika email terdaftar dan aktif, tautan reset akan dikirim.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-slate-700">Email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
            {error && <p role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</p>}
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Memproses..." : "Kirim tautan reset"}
            </button>
          </form>
        )}
        <p className="text-center text-sm"><Link href="/login" className="font-semibold text-blue-600 hover:underline">Kembali ke login</Link></p>
      </section>
    </main>
  );
}
