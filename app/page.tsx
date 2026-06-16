"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, Copy, Check, LogOut, Search } from "lucide-react";

type Move = {
  planId: string;
  rowIndex: number;
  destIndex: number;
  code: string;
  name: string;
  dest: string;
  qty: number;
  done: boolean;
  skipped: boolean;
  note: string;
  createdAt: string;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function daysSince(iso: string) {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

function CopyBtn({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      title="Copy code"
      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function ReasonInput({
  onSend,
  disabled,
}: {
  onSend: (r: string) => void;
  disabled?: boolean;
}) {
  const [val, setVal] = useState("");
  const send = () => {
    const r = val.trim();
    if (!r) return;
    onSend(r);
    setVal("");
  };
  return (
    <div className="flex items-center gap-1">
      <input
        value={val}
        placeholder="Reason if not transferring…"
        disabled={disabled}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        className="flex h-8 min-w-44 rounded-md border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || !val.trim()}
        onClick={send}
      >
        Send
      </Button>
    </div>
  );
}

const ALL = "__all__";

export default function HomePage() {
  const [branchName, setBranchName] = useState("");
  const [moves, setMoves] = useState<Move[]>([]);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [hideDone, setHideDone] = useState(true);

  // staged filter inputs (not applied until Search is clicked)
  const [inputDest, setInputDest] = useState(ALL);
  const [inputCode, setInputCode] = useState("");
  const [inputDateFrom, setInputDateFrom] = useState("2026-06-01");
  const [inputDateTo, setInputDateTo] = useState(
    new Date().toISOString().slice(0, 10),
  );

  // applied filters — drive the visible list
  const [filterDest, setFilterDest] = useState(ALL);
  const [filterCode, setFilterCode] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("2026-06-01");
  const [filterDateTo, setFilterDateTo] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/moves", { signal });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load");
      setBranchName(data.branchName);
      setMoves(data.moves);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    async function fetchMoves() {
      await load(ctrl.signal);
    }

    void fetchMoves();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveKey = (m: Move) => `${m.planId}-${m.rowIndex}-${m.destIndex}`;

  const toggle = (m: Move) => {
    if (m.done || m.skipped) return;
    const k = moveKey(m);
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });
  };

  const confirmPending = async () => {
    if (!pending.size) return;
    setUpdating(true);
    setError("");
    try {
      const toUpdate = moves.filter((m) => pending.has(moveKey(m)));
      const res = await fetch("/api/moves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: toUpdate.map((m) => ({
            planId: m.planId,
            rowIndex: m.rowIndex,
            destIndex: m.destIndex,
            value: true,
          })),
        }),
      });
      if (!res.ok)
        throw new Error((await res.json())?.error || "Update failed");
      setMoves((prev) =>
        prev.map((m) => (pending.has(moveKey(m)) ? { ...m, done: true } : m)),
      );
      setPending(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  const setSkip = async (m: Move, skipped: boolean, note: string) => {
    const k = moveKey(m);
    setMoves((prev) =>
      prev.map((x) =>
        moveKey(x) === k ? { ...x, skipped, note: skipped ? note : "" } : x,
      ),
    );
    try {
      const res = await fetch("/api/moves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [
            {
              planId: m.planId,
              rowIndex: m.rowIndex,
              destIndex: m.destIndex,
              skipped,
              note,
            },
          ],
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Failed");
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // unique destinations for filter dropdown
  const destOptions = useMemo(
    () => [...new Set(moves.map((m) => m.dest))].sort(),
    [moves],
  );

  const visible = useMemo(() => {
    return moves.filter((m) => {
      if (hideDone && (m.done || m.skipped)) return false;
      if (filterDest !== ALL && m.dest !== filterDest) return false;
      if (filterCode.trim()) {
        const q = filterCode.trim().toLowerCase();
        if (
          !m.code.toLowerCase().includes(q) &&
          !m.name.toLowerCase().includes(q)
        )
          return false;
      }
      if (filterDateFrom || filterDateTo) {
        const d = m.createdAt.slice(0, 10);
        if (filterDateFrom && d < filterDateFrom) return false;
        if (filterDateTo && d > filterDateTo) return false;
      }
      return true;
    });
  }, [moves, hideDone, filterDest, filterCode, filterDateFrom, filterDateTo]);

  const doneCount = moves.filter((m) => m.done).length;
  const skippedCount = moves.filter((m) => m.skipped).length;
  const pendingCount = pending.size;

  const markAll = () =>
    setPending(
      new Set(visible.filter((m) => !m.done && !m.skipped).map(moveKey)),
    );
  const unmarkAll = () => setPending(new Set());

  const runSearch = () => {
    setFilterDest(inputDest);
    setFilterCode(inputCode);
    setFilterDateFrom(inputDateFrom);
    setFilterDateTo(inputDateTo);
  };

  const resetFilters = () => {
    const today = new Date().toISOString().slice(0, 10);
    setInputDest(ALL);
    setInputCode("");
    setInputDateFrom("2026-06-01");
    setInputDateTo(today);
    setFilterDest(ALL);
    setFilterCode("");
    setFilterDateFrom("2026-06-01");
    setFilterDateTo(today);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      {/* header */}
      <div className="flex items-end justify-between gap-4 border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {branchName ? `${branchName} — Transfers` : "My Transfers"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Move each quantity to its destination, then tick it done.
          </p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={confirmPending}
          disabled={updating || pendingCount === 0}
          className="bg-green-600 hover:bg-green-700"
        >
          تحويل ({pendingCount})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={markAll}
          disabled={visible.length === 0 || updating}
        >
          Mark All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={unmarkAll}
          disabled={pendingCount === 0 || updating}
        >
          Unmark All
        </Button>
        <Button
          variant="outline"
          onClick={() => load()}
          disabled={loading || updating}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
        <label className="flex items-center gap-2 text-sm select-none">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          اخفاء ما تم
        </label>
        {!loading && (
          <span className="ml-auto text-sm text-muted-foreground">
            {doneCount} done · {skippedCount} skipped · {moves.length} total
          </span>
        )}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Sending to</label>
          <select
            value={inputDest}
            onChange={(e) => setInputDest(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value={ALL}>All destinations</option>
            {destOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Code or item</label>
          <input
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Search…"
            className="flex h-9 w-44 rounded-md border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Date from</label>
          <input
            type="date"
            value={inputDateFrom}
            onChange={(e) => setInputDateFrom(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Date to</label>
          <input
            type="date"
            value={inputDateTo}
            onChange={(e) => setInputDateTo(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <Button onClick={runSearch} disabled={loading} className="self-end">
          <Search className="h-3.5 w-3.5 mr-1" />
          Search
        </Button>
        <Button
          variant="outline"
          onClick={resetFilters}
          disabled={loading}
          className="self-end"
        >
          Reset
        </Button>

        <span className="self-end ml-auto text-xs text-muted-foreground">
          {visible.length} shown
        </span>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-20 text-center text-sm text-muted-foreground">
          Loading…
        </p>
      ) : moves.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted-foreground">
          No transfers ready yet — ترصيد must be marked done first.
        </p>
      ) : (
        <div className="overflow-auto rounded-md border max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b">
              <tr>
                <th className="w-10 px-3 py-2 text-left font-medium text-muted-foreground">
                  Done
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Code
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Item
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  تحويل الى فرع
                </th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                  الكمية
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  التاريخ
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  سبب عدم التحويل
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((m) => {
                const k = moveKey(m);
                const isPending = pending.has(k);
                const isOverdue =
                  !m.done && !m.skipped && daysSince(m.createdAt) > 4;
                return (
                  <tr
                    key={k}
                    className={[
                      isOverdue ? "bg-red-50 dark:bg-red-950/40" : "",
                      m.done || m.skipped ? "opacity-60" : "",
                      isPending ? "bg-yellow-50 dark:bg-yellow-950" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={isPending || m.done}
                        onChange={() => toggle(m)}
                        disabled={m.done || m.skipped}
                        aria-label={`Mark ${m.code} to ${m.dest} done`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span
                          className={`font-mono text-xs ${isOverdue ? "text-red-700 dark:text-red-400" : ""}`}
                        >
                          {m.code}
                        </span>
                        <CopyBtn code={m.code} />
                      </div>
                    </td>
                    <td dir="auto" className="px-3 py-2" title={m.name}>
                      {m.name}
                    </td>
                    <td dir="auto" className="px-3 py-2 whitespace-nowrap">
                      {m.dest}
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-semibold">
                      {fmt(m.qty)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {m.createdAt ? (
                        <span
                          className={
                            isOverdue
                              ? "font-semibold text-red-600 dark:text-red-400"
                              : ""
                          }
                        >
                          {new Date(m.createdAt).toLocaleDateString()}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {m.skipped ? (
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap rounded-full bg-amber-600/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                            Not transferring
                          </span>
                          <span
                            dir="auto"
                            className="max-w-45 truncate text-xs text-muted-foreground"
                            title={m.note}
                          >
                            {m.note}
                          </span>
                          <button
                            className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
                            onClick={() => setSkip(m, false, "")}
                          >
                            Undo
                          </button>
                        </div>
                      ) : m.done ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <ReasonInput
                          key={k}
                          onSend={(r) => setSkip(m, true, r)}
                          disabled={updating}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No moves match your filters.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
