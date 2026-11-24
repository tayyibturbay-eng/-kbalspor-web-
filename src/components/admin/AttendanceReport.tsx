// AttendanceReport.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useOnay } from "@/components/ui/OnayDialog";
import { createClient } from "@/lib/supabase/client";

type SessionRow = {
  id: string;
  title: string;
  session_date: string;
  is_active: boolean;
};

type AttendanceRow = {
  id: string;
  session_id: string;
  player_id: string;
};

type PlayerRow = {
  id: string;
  full_name: string;
  age_group: string;
};

export function AttendanceReport({
  isAdmin = false,
  onSessionDeleted,
}: {
  isAdmin?: boolean;
  onSessionDeleted?: () => void;
}) {
  const { onay, bildirim } = useOnay();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [groupFilter, setGroupFilter] = useState("Tümü");
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    const supabase = createClient();
    const [sRes, aRes, pRes] = await Promise.all([
      supabase
        .from("prayer_sessions")
        .select("*")
        .order("session_date", { ascending: false }),
      supabase.from("prayer_attendance").select("*"),
      supabase
        .from("players")
        .select("id, full_name, age_group")
        .order("full_name"),
    ]);
    if (sRes.data) setSessions(sRes.data as SessionRow[]);
    if (aRes.data) setAttendance(aRes.data as AttendanceRow[]);
    if (pRes.data) setPlayers(pRes.data as PlayerRow[]);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const [sRes, aRes, pRes] = await Promise.all([
        supabase
          .from("prayer_sessions")
          .select("*")
          .order("session_date", { ascending: false }),
        supabase.from("prayer_attendance").select("*"),
        supabase
          .from("players")
          .select("id, full_name, age_group")
          .order("full_name"),
      ]);
      if (!active) return;
      if (sRes.data) setSessions(sRes.data as SessionRow[]);
      if (aRes.data) setAttendance(aRes.data as AttendanceRow[]);
      if (pRes.data) setPlayers(pRes.data as PlayerRow[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleDeleteSession(sess: SessionRow) {
    if (!isAdmin) return;
    if (
      !(await onay(
        `"${sess.title}" (${sess.session_date}) etkinliğini ve bu etkinliğe ait tüm yoklama kayıtlarını kalıcı olarak silmek istediğinize emin misiniz?`,
        { baslik: "Etkinliği Sil", olumluMetin: "Evet, Sil" }
      ))
    )
      return;

    const supabase = createClient();
    await supabase
      .from("prayer_attendance")
      .delete()
      .eq("session_id", sess.id);
    const { error } = await supabase
      .from("prayer_sessions")
      .delete()
      .eq("id", sess.id);

    if (error) {
      bildirim("Etkinlik silinemedi: " + error.message);
      return;
    }

    bildirim("Etkinlik ve yoklama kayıtları silindi.");
    await loadReport();
    onSessionDeleted?.();
  }

  const leaderboard = useMemo(() => {
    const totalSessions = sessions.length;
    if (totalSessions === 0) return [];
    return players
      .filter((p) => groupFilter === "Tümü" || p.age_group === groupFilter)
      .map((p) => {
        const count = attendance.filter((a) => a.player_id === p.id).length;
        const pct = Math.round((count / totalSessions) * 100);
        return { player: p, count, totalSessions, pct };
      })
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [sessions, attendance, players, groupFilter]);

  const ageGroups = useMemo(() => {
    const set = new Set(players.map((p) => p.age_group));
    return ["Tümü", ...Array.from(set)];
  }, [players]);

  if (loading) {
    return (
      <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
        Katılım çizelgesi yükleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)]">
      <div className="bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-lg font-black text-[var(--text-primary)]">
              Düzenli Katılım Sıralaması
            </h3>
            <p className="text-xs text-[var(--text-secondary)] tabular-nums">
              Toplam {sessions.length} etkinlik üzerinden %80 ve üzeri katılım
              sağlayanlar Düzenli Katılımcı olarak işaretlenir.
            </p>
          </div>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-lg px-3 py-1.5 text-xs font-bold"
          >
            {ageGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {leaderboard.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">
            Henüz katılım kaydı bulunmuyor.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 tabular-nums">
            {leaderboard.map((item, idx) => (
              <div
                key={item.player.id}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  item.pct >= 80
                    ? "bg-[var(--status-warning-bg)]/55 border-amber-400"
                    : "bg-[var(--bg-subtle)] border-[var(--border-subtle)]"
                }`}
              >
                <div className="min-w-0">
                  <span className="font-black text-[var(--brand-ink)] mr-1.5">
                    #{idx + 1}
                  </span>
                  <strong className="text-[var(--text-primary)]">
                    {item.player.full_name}
                  </strong>
                  <span className="text-[var(--text-muted)] ml-1">
                    ({item.player.age_group})
                  </span>
                  {item.pct >= 80 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[10px]">
                      Düzenli Katılımcı
                    </span>
                  )}
                </div>
                <div className="font-extrabold text-[var(--brand-red)] shrink-0">
                  {item.count}/{item.totalSessions} (%{item.pct})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xs border border-[var(--border-subtle)] space-y-3">
        <h3 className="text-lg font-black text-[var(--text-primary)] tabular-nums">
          Geçmiş Etkinlikler ({sessions.length})
        </h3>
        {sessions.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">
            Kayıtlı etkinlik yok.
          </p>
        ) : (
          <div className="space-y-2.5">
            {sessions.map((s) => {
              const sessAtt = attendance.filter((a) => a.session_id === s.id);
              const names = sessAtt
                .map(
                  (a) => players.find((p) => p.id === a.player_id)?.full_name
                )
                .filter(Boolean);
              return (
                <div
                  key={s.id}
                  className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] space-y-1.5"
                >
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="text-sm">
                      <strong className="text-[var(--text-primary)]">
                        {s.title}
                      </strong>{" "}
                      <span className="text-xs text-[var(--text-muted)] tabular-nums">
                        ({s.session_date})
                      </span>
                      {s.is_active && (
                        <span className="ml-2 px-2 py-0.5 rounded bg-[var(--status-success-bg)] text-[var(--status-success-text)] text-[10px] font-extrabold">
                          Aktif
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-xs font-extrabold text-[var(--text-primary)]">
                        {sessAtt.length} Katılımcı
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(s)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer"
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  </div>
                  {names.length > 0 && (
                    <p className="text-xs text-[var(--text-secondary)]">
                      {names.join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}