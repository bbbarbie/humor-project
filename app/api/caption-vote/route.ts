import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveProfileIdByUserEmail } from "@/lib/supabase/profile";

const VALID_VOTES = new Set([1, -1]);

export async function POST(request: Request) {
  let payload: { captionId?: string; voteValue?: number } | null = null;

  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const captionId = payload?.captionId;
  const voteValue = payload?.voteValue;

  if (!captionId || !VALID_VOTES.has(voteValue ?? 0)) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const profileLookup = await resolveProfileIdByUserEmail(
    supabase,
    userData.user
  );
  if (!profileLookup.profileId) {
    return NextResponse.json(
      { error: profileLookup.error },
      { status: profileLookup.status }
    );
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from("caption_votes")
    .update({ vote_value: voteValue })
    .eq("profile_id", profileLookup.profileId)
    .eq("caption_id", captionId)
    .select("caption_id")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Vote failed." },
      { status: 500 }
    );
  }

  if (!updatedRow) {
    const insertPayload = {
      profile_id: profileLookup.profileId,
      caption_id: captionId,
      vote_value: voteValue,
    };

    let insertError = (
      await supabase.from("caption_votes").insert(insertPayload)
    ).error;

    if (
      insertError &&
      typeof insertError.message === "string" &&
      insertError.message.includes("created_datetime_utc")
    ) {
      const nowIso = new Date().toISOString();
      insertError = (
        await supabase.from("caption_votes").insert({
          ...insertPayload,
          created_datetime_utc: nowIso,
        })
      ).error;
    }

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message ?? "Vote failed." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, voteValue });
}
