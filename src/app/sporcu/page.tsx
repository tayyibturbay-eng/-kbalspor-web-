"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";
import { subscribeClubLiveUpdates } from "@/lib/realtime-club";
import { Due, Player, TaskAssignment } from "@/types/club";
import { PlayerHeader } from "@/components/sporcu/PlayerHeader";
import { PlayerCardSection } from "@/components/sporcu/PlayerCardSection";
import { PlayerProfileTab } from "@/components/sporcu/PlayerProfileTab";
import { PlayerEquipmentTab } from "@/components/sporcu/PlayerEquipmentTab";

const supabase = createClient();
const PLAYER_SESSION_KEY = "ikbal_logged_player_id";
const SPORCU_TAB_KEY = "ikbal_sporcu_tab";

type SporcuTab = "kartim" | "qr" | "program" | "malzeme" | "aidat" | "profil";

const VALID_SPORCU_TABS: SporcuTab[] = [
  "kartim",
  "qr",
  "program",
  "malzeme",
  "aidat",
  "profil",
];

interface EquipmentLogItem {
  id: string;
  player_id: string;
  item_type?: string | null;
  item_name: string;
  jersey_number?: number | null;
  size_label?: string | null;
  condition_status?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
}

interface JerseySetItem {
  id: string;
  set_name: string;
  kit_type: string;
  size_label?: string | null;
  total_count: number;
  available_count: number;
  photo_url: string | null;
}

interface StockItemRow {
  id: string;
  product_name: string;
  category: string;
  size_label?: string | null;
  total_count: number;
  available_count: number;
  photo_url: string | null;
}

function getSavedSporcuTab(): SporcuTab {
  if (typeof window === "undefined") return "profil";
  try {
    const saved = localStorage.getItem(SPORCU_TAB_KEY) as SporcuTab | null;
    if (saved && VALID_SPORCU_TABS.includes(saved)) {
      return saved;
    }
  } catch {
    // yoksay
  }
  return "profil";
}

function mapHeaderTabToSporcuTab(next: string): SporcuTab {
  if (next === "ekipman" || next === "malzeme") return "malzeme";
  if (next === "qr") return "qr";
  if (next === "program") return "program";
  if (next === "aidat") return "aidat";
  if (next === "kartim") return "kartim";
  return "profil";
}

export default function SporcuPage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTabState] = useState<SporcuTab>("profil");
  const [dues, setDues] = useState<Due[]>([]);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [equipmentLogs, setEquipmentLogs] = useState<EquipmentLogItem[]>([]);
  const [jerseySets, setJerseySets] = useState<JerseySetItem[]>([]);
  const [stockItems, setStockItems] = useState<StockItemRow[]>([]);
  const [feedback, setFeedback] = useState<string>("");

  const [loginCode, setLoginCode] = useState<string>("");
  const [loginPin, setLoginPin] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [loggingIn, setLoggingIn] = useState<boolean>(false);

  const setActiveTab = (next: SporcuTab) => {
    setActiveTabState(next);
    try {
      localStorage.setItem(SPORCU_TAB_KEY, next);
    } catch {
      // yoksay
    }
  };

  const loadPlayerData = useCallback(async (playerId: string) => {
    const [pRes, dRes, tRes, eqRes, jsRes, stRes] = await Promise.all([
      supabase.from("players").select("*").eq("id", playerId).maybeSingle(),
      supabase
        .from("dues")
        .select("*")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks_assignments")
        .select("*")
        .order("event_date", { ascending: true })
        .limit(20),
      supabase
        .from("equipment_logs")
        .select("*")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false }),
      supabase.from("jersey_sets").select("*"),
      supabase.from("equipment_stock").select("*"),
    ]);

    if (pRes.data) {
      setPlayer(pRes.data as Player);
    } else {
      setPlayer(null);
    }
    setDues((dRes.data as Due[] | null) || []);
    setTasks((tRes.data as TaskAssignment[] | null) || []);
    setEquipmentLogs((eqRes.data as EquipmentLogItem[] | null) || []);
    setJerseySets(
      (
        (jsRes.data as Array<{
          id: string;
          set_name: string;
          kit_type: string;
          size_label?: string | null;
          total_count: number;
          available_count: number;
          photo_url?: string | null;
        }> | null) || []
      ).map((j) => ({ ...j, photo_url: j.photo_url ?? null }))
    );
    setStockItems(
      (
        (stRes.data as Array<{
          id: string;
          product_name: string;
          category: string;
          size_label?: string | null;
          total_count: number;
          available_count: number;
          photo_url?: string | null;
        }> | null) || []
      ).map((s) => ({ ...s, photo_url: s.photo_url ?? null }))
    );
  }, []);

  useEffect(() => {
    let active = true;

    const initSession = async () => {
      try {
        const savedTab = getSavedSporcuTab();
        if (active) setActiveTabState(savedTab);

        const savedId =
          typeof window !== "undefined"
            ? localStorage.getItem(PLAYER_SESSION_KEY)
            : null;
        if (savedId && savedId.trim()) {
          await loadPlayerData(savedId.trim());
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void initSession();

    return () => {
      active = false;
    };
  }, [loadPlayerData]);

  useEffect(() => {
    if (!player?.id) return;
    return subscribeClubLiveUpdates(
      supabase,
      () => {
        void loadPlayerData(player.id);
      },
      `web-sporcu-${player.id}`
    );
  }, [player?.id, loadPlayerData]);

  async function handlePlayerLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const cleanCode = loginCode.trim().toUpperCase();
    const cleanPin = loginPin.trim();

    if (!cleanCode || !cleanPin) {
      setLoginError("Lütfen sporcu kodu ve PIN bilginizi girin.");
      return;
    }

    setLoggingIn(true);
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .ilike("player_code", cleanCode)
      .maybeSingle();
    setLoggingIn(false);

    if (error || !data) {
      setLoginError("Sporcu kodu bulunamadı.");
      return;
    }

    const row = data as Player & {
      pin?: string | null;
      password?: string | null;
    };
    const storedPin = String(row.pin || row.password || "").trim();
    if (storedPin && storedPin !== cleanPin) {
      setLoginError("PIN kodu hatalı.");
      return;
    }

    try {
      localStorage.setItem(PLAYER_SESSION_KEY, row.id);
      window.dispatchEvent(new Event("ikbal-auth-changed"));
    } catch {
      // yoksay
    }

    setPlayer(row);
    setActiveTab("kartim");
    await loadPlayerData(row.id);
  }

  function handleLogout() {
    try {
      localStorage.removeItem(PLAYER_SESSION_KEY);
      window.dispatchEvent(new Event("ikbal-auth-changed"));
    } catch {
      // yoksay
    }
    setPlayer(null);
    setDues([]);
    setTasks([]);
    setEquipmentLogs([]);
    setFeedback("");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 py-10 text-sm font-bold text-[var(--text-secondary)]">
          Sporcu paneli yükleniyor...
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <form
            onSubmit={handlePlayerLogin}
            className="w-full max-w-md bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 shadow-sm space-y-4"
          >
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--brand-red)]">
                Çorum İkbalspor • Sporcu Girişi
              </span>
              <h1 className="text-xl font-black text-[var(--text-primary)] mt-1">
                Sporcu Paneli Girişi
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Kartınızı, puanlarınızı, programınızı, aidatlarınızı ve malzeme
                durumunuzu görüntülemek için giriş yapın.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Sporcu Kodu
              </label>
              <input
                type="text"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                placeholder="Örn: D2 veya IKB-101"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                PIN Kodu
              </label>
              <input
                type="password"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                placeholder="••••"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] text-xs font-bold">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3 rounded-xl bg-[var(--brand-navy)] hover:opacity-95 text-white text-sm font-black cursor-pointer disabled:opacity-50"
            >
              {loggingIn ? "Giriş Yapılıyor..." : "Giriş Yap"}
            </button>
          </form>
        </main>
      </div>
    );
  }

  const tabs: Array<{ id: SporcuTab; label: string }> = [
    { id: "kartim", label: "Kartım" },
    { id: "qr", label: "QR Yoklama" },
    { id: "program", label: "Program & Maçlar" },
    { id: "malzeme", label: "Malzemelerim" },
    { id: "aidat", label: "Aidatlarım" },
    { id: "profil", label: "Profil & PIN" },
  ];

  const playerTasks = tasks.filter(
    (t) =>
      !t.age_group ||
      t.age_group === "Tümü" ||
      t.age_group === player.age_group
  );

  const unpaidDues = dues.filter((d) => {
    const row = d as Due & { is_paid?: boolean | null };
    return row.status !== "Ödendi" && !row.is_paid;
  });

  const activeEquipmentCount = equipmentLogs.filter(
    (eq) => eq.status !== "İade Edildi"
  ).length;

  const headerTab =
    activeTab === "malzeme" || activeTab === "kartim" ? "profil" : activeTab;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-14 transition-colors">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 pt-5 space-y-5">
        <PlayerHeader
          player={player}
          tab={headerTab as React.ComponentProps<typeof PlayerHeader>["tab"]}
          onTabChange={(next) => setActiveTab(mapHeaderTabToSporcuTab(next))}
          totalSessionsCount={0}
          attendanceRate={0}
          activeEquipmentCount={activeEquipmentCount}
          overdueCount={unpaidDues.length}
          currentUnpaid={unpaidDues.length > 0}
          onLogout={handleLogout}
        />

        {/* Tek Birleştirilmiş Sekme Çubuğu */}
        <div className="bg-[var(--bg-surface)] p-2 rounded-2xl border border-[var(--border-subtle)] shadow-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {tabs.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-red)] text-white shadow-xs"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className="p-3.5 rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success-text)] text-xs font-extrabold flex items-center justify-between">
            <span>{feedback}</span>
            <button
              type="button"
              onClick={() => setFeedback("")}
              className="underline ml-3 cursor-pointer"
            >
              Kapat
            </button>
          </div>
        )}

        {activeTab === "kartim" && (
          <PlayerCardSection
            player={player}
            onPlayerUpdated={(updated: Player) => setPlayer(updated)}
            onFeedback={setFeedback}
          />
        )}

        {activeTab === "qr" && (
          <section className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 shadow-xs space-y-3">
            <h2 className="text-base font-black text-[var(--text-primary)]">
              QR Yoklama
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Antrenman ve tesis QR oturumları aktif olduğunda buradan veya
              mobil uygulama üzerinden yoklama kaydınızı takip edebilirsiniz.
            </p>
            <div className="rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 text-xs font-bold text-[var(--text-primary)]">
              Aktif Sporcu Kodu: {player.player_code || "-"} • Yaş Grubu:{" "}
              {player.age_group}
            </div>
          </section>
        )}

        {activeTab === "program" && (
          <section className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 shadow-xs space-y-3">
            <h2 className="text-base font-black text-[var(--text-primary)]">
              Program &amp; Maçlar ({playerTasks.length})
            </h2>
            {playerTasks.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Henüz planlanmış maç veya görev bulunmuyor.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {playerTasks.map((t) => (
                  <div
                    key={t.id}
                    className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm"
                  >
                    <div>
                      <div className="font-extrabold text-[var(--text-primary)]">
                        {t.title}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {t.location || "Saha belirtilmedi"}
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-[var(--brand-navy-soft)] text-[var(--brand-navy)] dark:text-sky-300 text-xs font-extrabold">
                      {t.event_date || "-"}
                      {t.match_time ? ` • ${t.match_time}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "malzeme" && (
          <PlayerEquipmentTab
            equipmentLogs={
              equipmentLogs as unknown as React.ComponentProps<
                typeof PlayerEquipmentTab
              >["equipmentLogs"]
            }
            jerseySets={
              jerseySets as unknown as React.ComponentProps<
                typeof PlayerEquipmentTab
              >["jerseySets"]
            }
            stockItems={
              stockItems as unknown as React.ComponentProps<
                typeof PlayerEquipmentTab
              >["stockItems"]
            }
          />
        )}

        {activeTab === "aidat" && (
          <section className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 shadow-xs space-y-3">
            <h2 className="text-base font-black text-[var(--text-primary)]">
              Aidatlarım ({dues.length})
            </h2>
            {dues.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Aidat kaydı bulunmuyor.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {dues.map((d) => {
                  const dueRow = d as Due & {
                    month_label?: string | null;
                    month?: string | null;
                    is_paid?: boolean | null;
                  };
                  return (
                    <div
                      key={d.id}
                      className="py-3 flex items-center justify-between gap-2 text-xs sm:text-sm"
                    >
                      <span className="font-extrabold text-[var(--text-primary)]">
                        {dueRow.month_label || dueRow.month || "Aidat Kaydı"}
                      </span>
                      <span className="font-black text-[var(--brand-navy)] dark:text-sky-300">
                        {dueRow.status ||
                          (dueRow.is_paid ? "Ödendi" : "Bekliyor")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === "profil" && (
          <div className="space-y-6">
            <PlayerProfileTab
              {...({
                player,
                setPlayer,
                overdueCount: unpaidDues.length,
              } as unknown as React.ComponentProps<typeof PlayerProfileTab>)}
            />
            <PlayerCardSection
              player={player}
              onPlayerUpdated={(updated: Player) => setPlayer(updated)}
              onFeedback={setFeedback}
            />
          </div>
        )}
      </div>
    </div>
  );
}