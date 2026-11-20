"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";
import { AGE_GROUPS } from "@/types/club";

const supabase = createClient();

interface ClubMessageRow {
  id: string;
  sender_name: string | null;
  title?: string | null;
  body?: string | null;
  target_group?: string | null;
  age_group?: string | null;
  message_text?: string | null;
  created_at: string;
}

const FILTER_GROUPS = ["Tümü", ...AGE_GROUPS];

export default function MessagesPage() {
  const [messages, setMessages] = useState<ClubMessageRow[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("Tümü");
  const [senderName, setSenderName] = useState("");
  const [ageGroup, setAgeGroup] = useState("Tümü");
  const [title, setTitle] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadMessages() {
    const { data, error } = await supabase
      .from("club_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);

    if (!error && data) {
      setMessages(data as ClubMessageRow[]);
    }
  }

  useEffect(() => {
    loadMessages();
  }, []);

  const normalizedMessages = useMemo(() => {
    return messages
      .map((m) => {
        const groupLabel = m.target_group || m.age_group || "Tüm Kulüp";
        const bodyContent = m.body || m.message_text || "";
        return {
          id: m.id,
          sender: m.sender_name || "Kulüp Yönetimi",
          title: m.title || null,
          body: bodyContent,
          group: groupLabel,
          createdAt: m.created_at,
        };
      })
      .filter((m) => m.body.trim().length > 0)
      .filter((m) => {
        if (selectedFilter === "Tümü") return true;
        return (
          m.group.includes(selectedFilter) ||
          m.group === "Tümü" ||
          m.group === "Tüm Kulüp"
        );
      });
  }, [messages, selectedFilter]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!senderName.trim() || !messageText.trim()) return;
    setSending(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("club_messages")
      .insert({
        sender_name: senderName.trim(),
        title: title.trim() || `📢 Kulüp Mesajı (${ageGroup})`,
        body: messageText.trim(),
        target_group: ageGroup,
      })
      .select()
      .single();

    setSending(false);
    if (error) {
      setErrorMsg("Mesaj gönderilemedi: " + error.message);
      return;
    }
    if (data) {
      setMessages((prev) => [data as ClubMessageRow, ...prev]);
      setTitle("");
      setMessageText("");
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <section className="bg-gradient-to-r from-[#02274c] to-[#a60513] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-2">
          <h1 className="text-3xl font-black">
            İkbalspor Mesajlaşma & Duyurular
          </h1>
          <p className="text-slate-100">
            Antrenman programları, maç bilgilendirmeleri, veli-antrenör
            mesajları ve tek tıkla WhatsApp paylaşımı.
          </p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        <form
          onSubmit={handleSend}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4"
        >
          <h2 className="text-lg font-extrabold text-[#02274c]">
            Yeni Mesaj / Duyuru Gönder
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="Adınız / Göreviniz (Örn: Veli / Antrenör)"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="min-h-[46px] px-4 rounded-xl border-2 border-slate-300 text-sm"
            />
            <input
              type="text"
              placeholder="Konu Başlığı (Opsiyonel)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-h-[46px] px-4 rounded-xl border-2 border-slate-300 text-sm"
            />
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="min-h-[46px] px-4 rounded-xl border-2 border-slate-300 font-bold text-sm"
            >
              {FILTER_GROUPS.map((g) => (
                <option key={g} value={g}>
                  Hedef Grup: {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
                </option>
              ))}
            </select>
          </div>
          <textarea
            rows={3}
            required
            placeholder="Mesajınızı yazın..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="w-full p-4 rounded-xl border-2 border-slate-300 text-sm"
          />
          {errorMsg && (
            <p className="text-xs font-bold text-red-600">{errorMsg}</p>
          )}
          <button
            type="submit"
            disabled={sending}
            className="min-h-[48px] px-7 rounded-xl bg-[#a60513] hover:bg-red-700 text-white font-extrabold text-sm cursor-pointer disabled:opacity-60"
          >
            {sending ? "Gönderiliyor..." : "Mesajı Yayınla"}
          </button>
        </form>

        {/* Grup Filtresi */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setSelectedFilter(g)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                selectedFilter === g
                  ? "bg-[#02274c] text-white border-[#02274c]"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {g === "Çorum Süper Amatör Ligi" ? "SAL" : g}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {normalizedMessages.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500 text-center">
              Bu kategori için henüz yayınlanmış duyuru veya mesaj bulunmuyor.
            </div>
          ) : (
            normalizedMessages.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[#02274c]">{m.sender}</strong>
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#02274c] text-white text-xs font-bold">
                      {m.group}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(m.createdAt).toLocaleString("tr-TR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                {m.title && (
                  <h3 className="font-extrabold text-sm text-[#a60513]">
                    {m.title}
                  </h3>
                )}
                <p className="text-sm text-slate-700 whitespace-pre-line">
                  {m.body}
                </p>
                <div className="pt-1">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `[İkbalspor - ${m.group}] ${m.title ? m.title + "\n" : ""}${m.body}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
                  >
                    WhatsApp ile İlet
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}