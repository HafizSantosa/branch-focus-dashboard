"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token verifikasi tidak ditemukan.");
      return;
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: { error?: string }) => {
        if (data.error) {
          setStatus("error");
          setMessage(data.error);
        } else {
          setStatus("success");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Terjadi kesalahan. Coba lagi.");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto" />
            <p className="text-slate-300 text-sm">Memverifikasi akun Anda...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Akun Terverifikasi!</h2>
            <p className="text-sm text-slate-400">Email Anda berhasil diverifikasi. Silakan login.</p>
            <Link
              href="/login"
              className="inline-block mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Masuk Sekarang
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500 shadow-lg shadow-rose-500/30">
              <XCircle className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Verifikasi Gagal</h2>
            <p className="text-sm text-slate-400">{message}</p>
            <Link href="/login" className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300">
              ← Kembali ke login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
