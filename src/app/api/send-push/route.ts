import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  try {
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

    const supabase = createServerSupabaseClient();

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
          .filter(
            (tk): tk is string =>
              Boolean(tk) && tk.startsWith("ExponentPushToken")
          )
      )
    );

    if (uniqueTokens.length === 0) {
      return NextResponse.json({ ok: true, sentCount: 0 });
    }

    const cleanSound =
      typeof sound === "string" && sound.trim() ? sound.trim() : "default";
    const cleanImage =
      typeof imageUrl === "string" && imageUrl.trim()
        ? imageUrl.trim()
        : undefined;

    const tokenChunks = chunkArray(uniqueTokens, 100);
    let totalSent = 0;
    const errors: string[] = [];

    for (const chunk of tokenChunks) {
      const messages = chunk.map((token) => ({
        to: token,
        sound: cleanSound,
        title: title.trim(),
        body: body.trim(),
        ...(cleanImage ? { image: cleanImage } : {}),
        data: {
          ...(cleanImage ? { imageUrl: cleanImage } : {}),
          sound: cleanSound,
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
          {
            ok: false,
            error: `Expo Push hatası (${expoRes.status})`,
            sentCount: totalSent,
          },
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
            const detailErr =
              ticket.details?.error || ticket.message || "Bilinmeyen hata";
            errors.push(`${chunk[idx]?.slice(0, 28)}...: ${detailErr}`);
          }
        });
      }
    }

    if (totalSent === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: errors.join(" | "),
          sentCount: 0,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      sentCount: totalSent,
      warning: errors.length > 0 ? errors.join(" | ") : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Sunucu hatası",
        sentCount: 0,
      },
      { status: 500 }
    );
  }
}