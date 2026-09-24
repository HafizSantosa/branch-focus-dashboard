"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, Eye, Trash2, ToggleLeft,
  ToggleRight, Loader2, Users, UserPlus,
} from "lucide-react";
import { VALID_COMPANIES } from "@/lib/companies";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface User {
  id: string;
  username: string;
  email: string;
  company?: string | null;
  role: "admin" | "viewer";
  email_verified: number;
  active: number;
  created_at: number;
}

async function requestUsers(): Promise<User[]> {
  const response = await fetch("/api/admin/users", { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Gagal memuat daftar pengguna.");
  }
  return (await response.json()) as User[];
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Add user modal state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("admin");
  const [newEmailVerified, setNewEmailVerified] = useState(true);
  const [newCompany, setNewCompany] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setUsers(await requestUsers());
      setActionError(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Terjadi kesalahan jaringan."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;
    if (session.user.role !== "admin") {
      router.push("/");
      return;
    }

    let cancelled = false;
    void requestUsers()
      .then((loadedUsers) => {
        if (cancelled) return;
        setUsers(loadedUsers);
        setActionError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setActionError(
          error instanceof Error ? error.message : "Terjadi kesalahan jaringan."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, session, router]);

  const patch = async (id: string, body: object) => {
    setUpdating(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setActionError(payload.error ?? "Gagal memperbarui pengguna.");
        return;
      }
      await fetchUsers();
    } catch {
      setActionError("Terjadi kesalahan jaringan.");
    } finally {
      setUpdating(null);
    }
  };

  const remove = async (id: string, username: string) => {
    if (!confirm(`Hapus akun "${username}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setUpdating(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setActionError(payload.error ?? "Gagal menghapus pengguna.");
        return;
      }
      await fetchUsers();
    } catch {
      setActionError("Terjadi kesalahan jaringan.");
    } finally {
      setUpdating(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          email: newEmail.trim(),
          company: newCompany || undefined,
          password: newPassword,
          role: newRole,
          emailVerified: newEmailVerified,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "Gagal membuat pengguna.");
        setAddLoading(false);
        return;
      }

      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("admin");
      setNewEmailVerified(true);
      setNewCompany("");
      setIsAddUserOpen(false);
      await fetchUsers();
    } catch {
      setAddError("Terjadi kesalahan jaringan.");
    } finally {
      setAddLoading(false);
    }
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
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {users.length} pengguna
          </span>
          <button
            onClick={() => { setAddError(null); setIsAddUserOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Tambah Pengguna
          </button>
        </div>
      </header>

      <main className="p-6 space-y-3">
        {actionError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionError}
          </div>
        )}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pengguna</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Perusahaan</th>
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
                    <td className="px-4 py-3 text-slate-600 text-xs">{u.company || "-"}</td>
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
      {/* Modal Tambah Pengguna */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="sm:max-w-[460px] bg-white p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Tambah Pengguna Baru
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Buat akun pengguna baru dengan hak akses Admin atau Viewer.
            </DialogDescription>
          </DialogHeader>

          {addError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {addError}
            </div>
          )}

          <form onSubmit={handleAddUser} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Username</label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="contoh: budi_santoso"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Email</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nama@perusahaan.com"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Perusahaan</label>
              <select
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Pilih Perusahaan (opsional)...</option>
                {VALID_COMPANIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Password</label>
              <input
                type="password"
                required
                minLength={12}
                maxLength={72}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 12 karakter"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Hak Akses (Role)</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setNewRole("admin")}
                  className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                    newRole === "admin"
                      ? "border-blue-500 bg-blue-50/60 text-blue-900 ring-2 ring-blue-500/20 shadow-sm"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-blue-700">
                    <ShieldCheck className="w-4 h-4" /> Admin
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Akses penuh: kelola pengguna, ubah URL data sheet, kelola backup, dan unduh CSV.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setNewRole("viewer")}
                  className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                    newRole === "viewer"
                      ? "border-blue-500 bg-blue-50/60 text-blue-900 ring-2 ring-blue-500/20 shadow-sm"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-700">
                    <Eye className="w-4 h-4" /> Viewer
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Lihat dashboard, filter data, dan unduh CSV Detail Data; tidak dapat mengelola pengguna atau backup.
                  </p>
                </button>
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newEmailVerified}
                  onChange={(e) => setNewEmailVerified(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs">
                  <span className="font-medium text-slate-700">Langsung aktifkan & verifikasi akun</span>
                  <p className="text-slate-500 text-[11px]">Pengguna dapat langsung login tanpa perlu verifikasi email.</p>
                </div>
              </label>
            </div>

            <DialogFooter className="pt-3 gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={addLoading}
                onClick={() => setIsAddUserOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={addLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {addLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Menyimpan...
                  </>
                ) : (
                  "Simpan Pengguna"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
