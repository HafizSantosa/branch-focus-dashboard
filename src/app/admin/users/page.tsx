"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, Eye, Trash2, ToggleLeft,
  ToggleRight, Loader2, Users,
} from "lucide-react";

interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "viewer";
  email_verified: number;
  active: number;
  created_at: number;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json() as User[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated") {
      if (session.user.role !== "admin") { router.push("/"); return; }
      fetchUsers();
    }
  }, [status, session, router, fetchUsers]);

  const patch = async (id: string, body: object) => {
    setUpdating(id);
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await fetchUsers();
    setUpdating(null);
  };

  const remove = async (id: string, username: string) => {
    if (!confirm(`Hapus akun "${username}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setUpdating(id);
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    await fetchUsers();
    setUpdating(null);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <header className="h-14 px-6 bg-white/80 backdrop-blur border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-slate-300">/</span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Users className="w-4 h-4 text-blue-600" />
            Manajemen Pengguna
          </span>
        </div>
        <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {users.length} pengguna
        </span>
      </header>

      <main className="p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pengguna</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Terdaftar</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isSelf = u.username === session?.user?.name;
                const busy = updating === u.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{u.username}</span>
                      {isSelf && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Anda</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3 h-3" /> Admin
                        </span>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() => patch(u.id, { role: u.role === "admin" ? "viewer" : "admin" })}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${
                            u.role === "admin"
                              ? "text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100"
                              : "text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {u.role === "admin" ? <ShieldCheck className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {u.role === "admin" ? "Admin" : "Viewer"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full w-fit ${u.email_verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {u.email_verified ? "Terverifikasi" : "Belum verifikasi"}
                        </span>
                        {!isSelf && (
                          <button
                            disabled={busy}
                            onClick={() => patch(u.id, { active: !u.active })}
                            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors w-fit"
                          >
                            {u.active
                              ? <ToggleRight className="w-3.5 h-3.5 text-emerald-500" />
                              : <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />}
                            {u.active ? "Aktif" : "Nonaktif"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(u.created_at * 1000).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf && (
                        <button
                          disabled={busy}
                          onClick={() => remove(u.id, u.username)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                          title="Hapus akun"
                        >
                          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">
                    Belum ada pengguna.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
