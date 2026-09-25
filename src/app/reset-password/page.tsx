"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, KeyRound } from "lucide-react";

export default function ResetPasswordPage() {
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "Tautan reset tidak valid atau sudah kedaluwarsa.");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError("Tautan reset tidak valid atau sudah kedaluwarsa.");
      return;
    }
    if (password !== confirmation) {
      setError("Password baru tidak cocok.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) setError(result.error ?? "Terjadi kesalahan. Coba lagi.");
      else setSuccess(true);
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
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600"><KeyRound className="w-6 h-6" /></div>
          <h1 className="text-xl font-bold text-slate-800">Buat password baru</h1>
        </div>
        {success ? (
          <div role="status" className="space-y-4 text-center">
            <p className="text-sm text-emerald-800">Password berhasil diubah. Silakan masuk kembali.</p>
            <Link href="/login" className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg">Ke login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {token && <>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-medium text-slate-700">Password baru</label>
                <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirmation" className="text-xs font-medium text-slate-700">Ulangi password baru</label>
                <input id="confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} required className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
            </>}
            {error && <p role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</p>}
            {token && <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Memproses..." : "Simpan password baru"}
            </button>}
            <p className="text-center text-sm"><Link href="/login" className="font-semibold text-blue-600 hover:underline">Kembali ke login</Link></p>
          </form>
        )}
      </section>
    </main>
  );
}
