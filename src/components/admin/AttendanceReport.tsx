"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOnay } from "@/components/ui/OnayDialog";
import { Iskelet } from "@/components/ikbal/Motion";
import { createClient } from "@/lib/supabase/client";
import { SPRING } from "@/lib/motion";

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

  // Optimistic oturum silme + rollback
  async function handleDeleteSession(sess: SessionRow) {
    if (!isAdmin) return;
    if (
      !(await onay(
        `"${sess.title}" (${sess.session_date}) etkinliğini ve bu etkinliğe ait tüm yoklama kayıtlarını kalıcı olarak silmek istediğinize emin misiniz?`,
        { baslik: "Etkinliği Sil", olumluMetin: "Evet, Sil" }
      ))
    )
      return;

    const prevSessions = sessions;
    const prevAttendance = attendance;
    setSessions((prev) => prev.filter((x) => x.id !== sess.id));
    setAttendance((prev) => prev.filter((a) => a.session_id !== sess.id));
    bildirim("Etkinlik ve yoklama kayıtları silindi.");

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
      setSessions(prevSessions);
      setAttendance(prevAttendance);
      bildirim("Etkinlik silinemedi, geri alındı: " + error.message);
      return;
    }

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
      <div className="k-artik p-5 space-y-3">
        <Iskelet className="h-6 w-56" radius={10} />
        <div className="grid sm:grid-cols-3 gap-2.5">
          {[1, 2, 3].map((n) => (
            <Iskelet key={n} className="h-14 w-full" radius={14} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[var(--text-primary)] tabular-nums">
      <div className="k-artik p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="space-y-0.5">
            <span className="k-koz text-[10px] block">DEVAMLILIK ANALİZİ</span>
            <h3 className="k-posta text-lg text-[var(--text-primary)]">
              Düzenli Katılım Sıralaması
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Toplam {sessions.length} etkinlik üzerinden %80 ve üzeri katılım
              sağlayanlar Düzenli Katılımcı olarak işaretlenir.
            </p>
          </div>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="k-alan !w-auto !py-1.5 text-xs font-bold"
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {leaderboard.map((item, idx) => (
              <div
                key={item.player.id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
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

      <div className="k-artik p-5 sm:p-6 space-y-3.5">
        <div className="space-y-0.5">
          <span className="k-koz text-[10px] block">YOKLAMA GEÇMİŞİ</span>
          <h3 className="k-posta text-lg text-[var(--text-primary)]">
            Geçmiş Etkinlikler ({sessions.length})
          </h3>
        </div>
        {sessions.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">
            Kayıtlı etkinlik yok.
          </p>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {sessions.map((s) => {
                const sessAtt = attendance.filter((a) => a.session_id === s.id);
                const names = sessAtt
                  .map(
                    (a) => players.find((p) => p.id === a.player_id)?.full_name
                  )
                  .filter(Boolean);
                return (
                  <motion.div
                    layout
                    key={s.id}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={SPRING.yumusak}
                    className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] space-y-1.5"
                  >
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="text-sm flex flex-wrap items-center gap-2">
                        <strong className="text-[var(--text-primary)]">
                          {s.title}
                        </strong>
                        <span className="text-xs text-[var(--text-muted)]">
                          ({s.session_date})
                        </span>
                        {s.is_active && (
                          <span className="k-etiket k-etiket--basari">
                            Aktif
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="k-etiket k-etiket--lacivert">
                          {sessAtt.length} Katılımcı
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSession(s)}
                            className="px-3 py-1 rounded-xl bg-[var(--status-danger-bg)] hover:opacity-85 text-[var(--status-danger-text)] text-xs font-extrabold cursor-pointer transition"
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
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}