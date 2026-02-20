import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CaptionRow = {
  id: string;
  content: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageId = searchParams.get("imageId");

  if (!imageId) {
    return NextResponse.json({ captions: [] });
  }

  const supabase = await createSupabaseServerClient();

  const { data: captions, error: captionsError } = await supabase
    .from("captions")
    .select("id,content")
    .eq("image_id", imageId);

  if (captionsError) {
    console.error("Supabase captions query error in /api/image-captions:", captionsError);
    return NextResponse.json({ captions: [] });
  }

  const captionRows = (captions ?? []) as CaptionRow[];
  return NextResponse.json({ captions: captionRows });
}
