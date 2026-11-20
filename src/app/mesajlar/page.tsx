"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/ikbal/Navbar";
import { createClient } from "@/lib/supabase/client";

interface MessageItem {
  id: string;
  sender_name: string;
  age_group: string;
  message_text: string;
  created_at: string;
}

const GROUPS = ["Tümü", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18", "U19"];

export default function MessagesPage() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [senderName, setSenderName] = useState("");
  const [ageGroup, setAgeGroup] = useState("Tümü");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const loadMessages = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("club_messages")
      .select("id, sender_name, age_group, message_text, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setMessages((data as MessageItem[]) || []);
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim() || !messageText.trim()) return;
    setSending(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("club_messages")
      .insert({
        sender_name: senderName.trim(),
        age_group: ageGroup,
        message_text: messageText.trim(),
      })
      .select()
      .single();
    setSending(false);
    if (!error && data) {
      setMessages((prev) => [data as MessageItem, ...prev]);
      setMessageText("");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      <Navbar />

      <section className="bg-gradient-to-r from-[#02274c] to-[#a60513] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-2">
          <h1 className="text-3xl font-black">İkbalspor Mesajlaşma & Duyurular</h1>
          <p className="text-slate-100">
            Antrenman duyuruları, veli-antrenör mesajları ve tek tıkla WhatsApp
            paylaşımı.
          </p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        <form
          onSubmit={handleSend}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4"
        >
          <h2 className="text-lg font-extrabold text-[#02274c]">Yeni Mesaj / Duyuru Gönder</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Adınız / Göreviniz (Örn: Veli / Antrenör)"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="min-h-[46px] px-4 rounded-xl border-2 border-slate-300"
            />
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="min-h-[46px] px-4 rounded-xl border-2 border-slate-300 font-bold"
            >
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  Hedef Grup: {g}
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
            className="w-full p-4 rounded-xl border-2 border-slate-300"
          />
          <button
            type="submit"
            disabled={sending}
            className="min-h-[48px] px-7 rounded-xl bg-[#a60513] hover:bg-red-700 text-white font-extrabold"
          >
            {sending ? "Gönderiliyor..." : "Mesajı Yayınla"}
          </button>
        </form>

        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <strong className="text-[#02274c]">{m.sender_name}</strong>
                  <span className="px-2.5 py-0.5 rounded-lg bg-[#02274c] text-white text-xs font-bold">
                    {m.age_group}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(m.created_at).toLocaleString("tr-TR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <p className="text-slate-700">{m.message_text}</p>
              <div className="pt-1">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `[İkbalspor - ${m.age_group}] ${m.sender_name}: ${m.message_text}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
                >
                  WhatsApp ile İlet
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}