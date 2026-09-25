"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";

export default function ChangePasswordPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  if (status === "loading" || session?.user?.authenticated === false) return null;
  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.next !== form.confirm) { setError("Password baru tidak cocok."); return; }
    if (form.next.length < 12) { setError("Password minimal 12 karakter."); return; }

    setLoading(true);
    const res = await fetch("/api/user/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
    });
    const data = await res.json() as { error?: string };
    setLoading(false);

    if (!res.ok) { setError(data.error ?? "Terjadi kesalahan."); return; }
    setSuccess(true);
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20 mb-4">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-800">Ganti Password</h1>
          <p className="text-xs text-slate-500 mt-1">Akun: <strong>{session?.user?.name}</strong></p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          {success ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-medium text-slate-700">Password berhasil diubah.</p>
              <Link href="/" className="inline-block mt-2 text-sm text-blue-600 hover:underline">
                ← Kembali ke dashboard
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {([
                { key: "current", label: "Password Saat Ini" },
                { key: "next",    label: "Password Baru" },
                { key: "confirm", label: "Konfirmasi Password Baru" },
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 block">{label}</label>
                  <input
                    type="password"
                    value={form[key]}
                    onChange={set(key)}
                    required
                    minLength={key === "current" ? undefined : 12}
                    maxLength={72}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              ))}

              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {loading ? "Memproses..." : "Simpan Password"}
              </button>

              <Link href="/" className="block text-center text-xs text-slate-400 hover:text-slate-600 mt-2">
                Batal
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
