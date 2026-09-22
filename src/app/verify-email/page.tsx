"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [message, setMessage] = useState(
    token ? "" : "Token verifikasi tidak ditemukan."
  );
  const verifyingRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (verifyingRef.current) return;
    verifyingRef.current = true;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
              <p className="text-slate-600 text-sm">Memverifikasi akun Anda...</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Akun Terverifikasi!</h2>
              <p className="text-sm text-slate-600">Email Anda berhasil diverifikasi. Silakan login.</p>
              <Link
                href="/login"
                className="inline-block mt-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shadow-blue-600/20"
              >
                Masuk Sekarang
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mx-auto">
                <XCircle className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Verifikasi Gagal</h2>
              <p className="text-sm text-slate-600">{message}</p>
              <Link href="/login" className="inline-block pt-2 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                ← Kembali ke login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
