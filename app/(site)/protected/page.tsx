import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TransitionClient from "./TransitionClient";

export default async function ProtectedPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log("[protected] getUser user:", user ? user.email ?? "no-email" : null);

  if (!user) {
    redirect("/login");
  }

  return (
    <TransitionClient email={user.email ?? null} />
  );
}
