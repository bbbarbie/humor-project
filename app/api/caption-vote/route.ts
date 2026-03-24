import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveProfileIdByUserEmail } from "@/lib/supabase/profile";

const VALID_VOTES = new Set([1, -1]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const captionId = searchParams.get("captionId");

  if (!captionId) {
    return NextResponse.json({ error: "captionId is required." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const profileLookup = await resolveProfileIdByUserEmail(supabase, userData.user);
  if (!profileLookup.profileId) {
    return NextResponse.json(
      { error: profileLookup.error },
      { status: profileLookup.status }
    );
  }

  console.info("caption-vote GET using profile_id", profileLookup.profileId);

  const { data: voteRow, error: voteError } = await supabase
    .from("caption_votes")
    .select("vote_value")
    .eq("profile_id", profileLookup.profileId)
    .eq("caption_id", captionId)
    .limit(1)
    .maybeSingle();

  if (voteError) {
    return NextResponse.json(
      { error: voteError.message ?? "Unable to load vote." },
      { status: 500 }
    );
  }

  return NextResponse.json({ voteValue: voteRow?.vote_value ?? null });
}

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

  const profileId = profileLookup.profileId;
  console.info("caption-vote POST using profile_id", profileId);

  const { data: updatedRow, error: updateError } = await supabase
    .from("caption_votes")
    .update({
      vote_value: voteValue,
      modified_by_user_id: profileId,
    })
    .eq("profile_id", profileId)
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
      profile_id: profileId,
      caption_id: captionId,
      vote_value: voteValue,
      created_by_user_id: profileId,
      modified_by_user_id: profileId,
    };

    const { error: insertError } = await supabase
      .from("caption_votes")
      .insert(insertPayload);

    if (insertError) {
      console.error("caption-vote insert failed", {
        profile_id: profileId,
        caption_id: captionId,
        error: insertError,
      });
      return NextResponse.json(
        { error: insertError.message ?? "Vote failed." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, voteValue });
}
