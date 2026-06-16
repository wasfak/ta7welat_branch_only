"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, Pencil, Trash2, X, Check, Download } from "lucide-react";
import * as XLSX from "xlsx";

type Branch = { branchId: string; name: string };

type Modal =
  | { type: "add" }
  | { type: "edit"; branch: Branch }
  | { type: "delete"; branch: Branch }
  | null;

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

export default function AdminPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // form fields
  const [fId, setFId] = useState("");
  const [fName, setFName] = useState("");
  const [fPw, setFPw] = useState("");

  const router = useRouter();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/branches");
      if (res.status === 403) { router.push("/adm/login"); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load");
      setBranches(data.branches);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => {
    setFId(""); setFName(""); setFPw(""); setFormError("");
    setModal({ type: "add" });
  };

  const openEdit = (b: Branch) => {
    setFId(b.branchId); setFName(b.name); setFPw(""); setFormError("");
    setModal({ type: "edit", branch: b });
  };

  const openDelete = (b: Branch) => {
    setFormError("");
    setModal({ type: "delete", branch: b });
  };

  const closeModal = () => setModal(null);

  const saveAdd = async () => {
    if (!fId.trim() || !fName.trim() || !fPw.trim()) {
      setFormError("All fields are required"); return;
    }
    setSaving(true); setFormError("");
    try {
      const res = await fetch("/api/admin/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: fId.trim(), name: fName.trim(), password: fPw.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      closeModal();
      await load();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!fName.trim()) { setFormError("Name is required"); return; }
    setSaving(true); setFormError("");
    try {
      const body: Record<string, string> = { branchId: fId, name: fName.trim() };
      if (fPw.trim()) body.password = fPw.trim();
      const res = await fetch("/api/admin/branches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      closeModal();
      await load();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (modal?.type !== "delete") return;
    setSaving(true); setFormError("");
    try {
      const res = await fetch("/api/admin/branches", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: modal.branch.branchId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      closeModal();
      await load();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/adm/login");
  };

  const exportExcel = () => {
    const rows = branches.map((b) => ({ "Branch ID": b.branchId, Name: b.name }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 24 }, { wch: 28 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Branches");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `branch-ids-${today}.xlsx`);
  };

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      {/* header */}
      <div className="flex items-end justify-between gap-4 border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branch Manager</h1>
          <p className="text-sm text-muted-foreground">
            Add, rename, or remove branch accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportExcel} disabled={loading || branches.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Export Excel
          </Button>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add branch
          </Button>
          <button
            onClick={logout}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Branch ID</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {branches.map((b) => (
                <tr key={b.branchId} className="hover:bg-muted/20">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{b.branchId}</td>
                  <td className="px-4 py-2 font-medium" dir="auto">{b.name}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(b)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openDelete(b)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* modal backdrop */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            {/* Add */}
            {modal.type === "add" && (
              <>
                <h2 className="text-lg font-semibold">Add branch</h2>
                <Field label="Branch ID" value={fId} onChange={setFId} placeholder="e.g. rehab" />
                <Field label="Name" value={fName} onChange={setFName} placeholder="e.g. Rehab" />
                <Field label="Password" value={fPw} onChange={setFPw} type="password" placeholder="••••••••" />
                {formError && <p className="text-sm text-destructive">{formError}</p>}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeModal} disabled={saving}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button onClick={saveAdd} disabled={saving}>
                    <Check className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Add"}
                  </Button>
                </div>
              </>
            )}

            {/* Edit */}
            {modal.type === "edit" && (
              <>
                <h2 className="text-lg font-semibold">Edit branch</h2>
                <Field label="Branch ID (fixed)" value={fId} onChange={() => {}} placeholder="" />
                <Field label="Name" value={fName} onChange={setFName} />
                <Field label="New password (leave blank to keep)" value={fPw} onChange={setFPw} type="password" placeholder="••••••••" />
                {formError && <p className="text-sm text-destructive">{formError}</p>}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeModal} disabled={saving}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button onClick={saveEdit} disabled={saving}>
                    <Check className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </>
            )}

            {/* Delete */}
            {modal.type === "delete" && (
              <>
                <h2 className="text-lg font-semibold">Delete branch</h2>
                <p className="text-sm text-muted-foreground">
                  Remove <span className="font-semibold text-foreground">{modal.branch.name}</span>? This cannot be undone.
                </p>
                {formError && <p className="text-sm text-destructive">{formError}</p>}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeModal} disabled={saving}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button variant="destructive" onClick={confirmDelete} disabled={saving}>
                    <Trash2 className="h-4 w-4 mr-1" /> {saving ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
