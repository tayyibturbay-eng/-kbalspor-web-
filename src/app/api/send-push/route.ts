import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let query = supabase.from("player_push_tokens").select("expo_push_token, age_group");
    if (ageGroups && ageGroups.length > 0 && !ageGroups.includes("Tümü")) {
      query = query.in("age_group", ageGroups);
    }

    const { data: tokens, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message, sentCount: 0 }, { status: 500 });
    }

    const uniqueTokens = Array.from(
      new Set((tokens || []).map((t) => t.expo_push_token).filter(Boolean))
    );

    if (uniqueTokens.length === 0) {
      return NextResponse.json({ ok: true, sentCount: 0 });
    }

    const messages = uniqueTokens.map((token) => ({
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
        { ok: false, error: `Expo Push hatası (${expoRes.status})`, sentCount: 0 },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, sentCount: uniqueTokens.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sunucu hatası", sentCount: 0 },
      { status: 500 }
    );
  }
}