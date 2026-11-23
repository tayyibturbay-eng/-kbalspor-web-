import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

type ExpoPushTicket = {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

const DEFAULT_LOGO_URL = "https://ikbalspor.com/logo.png";

async function verifyAdminRequest(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  if (!url || !anon) return false;

  const authClient = createClient(url, anon, {
    auth: { persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  return !error && Boolean(data?.user);
}

export async function POST(req: Request) {
  try {
    const isAuthorized = await verifyAdminRequest(req);
    if (!isAuthorized) {
      return NextResponse.json(
        { ok: false, error: "Bu işlem için yönetici yetkisi gereklidir.", sentCount: 0 },
        { status: 401 }
      );
    }

    const { ageGroups, title, body, imageUrl, sound } = (await req.json()) as {
      ageGroups?: string[];
      title?: string;
      body?: string;
      imageUrl?: string;
      sound?: string;
    };

    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Başlık ve mesaj zorunludur.", sentCount: 0 },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient(true);

    let query = supabase
      .from("player_push_tokens")
      .select("expo_push_token, age_group");

    if (ageGroups && ageGroups.length > 0 && !ageGroups.includes("Tümü")) {
      query = query.in("age_group", ageGroups);
    }

    const { data: tokens, error } = await query;
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, sentCount: 0 },
        { status: 500 }
      );
    }

    const uniqueTokens = Array.from(
      new Set(
        (tokens || [])
          .map((t) => t.expo_push_token)
          .filter((tk): tk is string => Boolean(tk) && tk.startsWith("ExponentPushToken"))
      )
    );

    if (uniqueTokens.length === 0) {
      return NextResponse.json({ ok: true, sentCount: 0 });
    }

    const cleanSound =
      typeof sound === "string" && sound.trim() ? sound.trim() : "default";
    const rawImg =
      typeof imageUrl === "string" && imageUrl.trim()
        ? imageUrl.trim()
        : DEFAULT_LOGO_URL;
    const normalizedImg = rawImg.startsWith("/")
      ? `https://ikbalspor.com${rawImg}`
      : rawImg;
    const cleanImage =
      normalizedImg.startsWith("https://") &&
      !normalizedImg.startsWith("blob:") &&
      !normalizedImg.startsWith("data:")
        ? normalizedImg
        : DEFAULT_LOGO_URL;

    const tokenChunks = chunkArray(uniqueTokens, 100);
    let totalSent = 0;
    const errors: string[] = [];

    for (const chunk of tokenChunks) {
      const messages = chunk.map((token) => ({
        to: token,
        sound: "default",
        channelId: "ikbalspor-alerts",
        priority: "high",
        title: title.trim(),
        body: body.trim(),
        image: cleanImage,
        richContent: { image: cleanImage },
        data: {
          imageUrl: cleanImage,
          sound: "default",
          channelId: "ikbalspor-alerts",
          title: title.trim(),
          body: body.trim(),
        },
      }));

      const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(messages),
      });

      const expoJson = (await expoRes.json().catch(() => null)) as {
        data?: ExpoPushTicket[];
      } | null;

      if (!expoRes.ok) {
        return NextResponse.json(
          { ok: false, error: `Expo Push hatası (${expoRes.status})`, sentCount: totalSent },
          { status: 502 }
        );
      }

      const tickets = Array.isArray(expoJson?.data) ? expoJson.data : [];
      if (tickets.length === 0) {
        totalSent += chunk.length;
      } else {
        tickets.forEach((ticket, idx) => {
          if (ticket.status === "ok") {
            totalSent += 1;
          } else {
            const detailErr = ticket.details?.error || ticket.message || "Bilinmeyen hata";
            errors.push(`${chunk[idx]?.slice(0, 28)}...: ${detailErr}`);
          }
        });
      }
    }

    return NextResponse.json({
      ok: totalSent > 0 || errors.length === 0,
      sentCount: totalSent,
      warning: errors.length > 0 ? errors.join(" | ") : undefined,
      error: totalSent === 0 && errors.length > 0 ? errors.join(" | ") : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sunucu hatası", sentCount: 0 },
      { status: 500 }
    );
  }
}