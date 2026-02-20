import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import LoginPage from "@/app/(auth)/login/page";

export default async function ProtectedPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return <LoginPage />;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
    },
  });

  const { data } = await supabase.auth.getSession();
  console.log(
    "[protected] getSession present:",
    data.session ? true : false
  );

  if (data.session) {
    redirect("/list");
  }

  return <LoginPage />;
}
