import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveProfileIdByUserEmail } from "@/lib/supabase/profile";

type CaptionRow = {
  id: string;
  content: string | null;
  userVote: number | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageId = searchParams.get("imageId");

  if (!imageId) {
    return NextResponse.json({ captions: [] });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const profileLookup = userData.user
    ? await resolveProfileIdByUserEmail(supabase, userData.user)
    : null;

  const { data: captions, error: captionsError } = await supabase
    .from("captions")
    .select("id,content")
    .eq("image_id", imageId);

  if (captionsError) {
    if (captionsError.code === "22P02") {
      return NextResponse.json({ captions: [] });
    }
    console.error("Supabase captions query error in /api/image-captions:", captionsError);
    return NextResponse.json({ captions: [] });
  }

  const rawCaptionRows = (captions ?? []) as Array<{
    id: string;
    content: string | null;
  }>;
  const captionIds = rawCaptionRows.map((caption) => caption.id);

  let voteByCaptionId = new Map<string, number>();
  if (profileLookup?.profileId && captionIds.length > 0) {
    const { data: votes, error: votesError } = await supabase
      .from("caption_votes")
      .select("caption_id,vote_value")
      .eq("profile_id", profileLookup.profileId)
      .in("caption_id", captionIds);

    if (votesError) {
      console.error(
        "Supabase caption_votes query error in /api/image-captions:",
        votesError
      );
    } else {
      voteByCaptionId = new Map(
        (votes ?? []).map((vote) => [String(vote.caption_id), vote.vote_value])
      );
    }
  }

  const captionRows: CaptionRow[] = rawCaptionRows.map((caption) => ({
    id: caption.id,
    content: caption.content,
    userVote: voteByCaptionId.get(String(caption.id)) ?? null,
  }));
  return NextResponse.json({ captions: captionRows });
}
