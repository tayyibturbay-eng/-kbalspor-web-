import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function POST(req: Request) {
  try {
    const { ageGroups, title, body } = (await req.json()) as {
      ageGroups?: string[];
      title?: string;
      body?: string;
    };

    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Başlık ve mesaj zorunludur.", sentCount: 0 },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    let query = supabase.from("player_push_tokens").select("expo_push_token, age_group");
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

    // Expo Push API tek seferde en fazla 100 mesaj kabul eder
    const tokenChunks = chunkArray(uniqueTokens, 100);
    let totalSent = 0;

    for (const chunk of tokenChunks) {
      const messages = chunk.map((token) => ({
        to: token,
        sound: "default",
        title: title.trim(),
        body: body.trim(),
      }));

      const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(messages),
      });

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

      totalSent += chunk.length;
    }

    return NextResponse.json({ ok: true, sentCount: totalSent });
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