"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import FuturisticBackground from "@/app/components/FuturisticBackground";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setError("Missing Supabase environment variables.");
      return;
    }

    setLoading(true);

    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: "pkce",
      },
    });
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setError(signInError.message);
    }

    setLoading(false);
  };

  return (
    <div className="relative isolate min-h-dvh overflow-hidden text-[#e7edf6]">
      <FuturisticBackground />
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-6 md:px-10">
        <div className="glass-card w-full max-w-[480px] bg-white/5 backdrop-blur-2xl border border-white/10">
          <div className="glass-header">
            <p className="glass-eyebrow">Welcome Back</p>
            <h1>Sign in to continue.</h1>
            <p>Use Google to access the protected area.</p>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="login-google-button"
            disabled={loading}
          >
            <span className="login-google-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M23.53 12.27c0-.83-.07-1.43-.23-2.05H12.24v3.9h6.55c-.13.98-.83 2.46-2.38 3.45l-.02.13 3.5 2.71.24.02c2.2-2.03 3.5-5.01 3.5-8.16Z"
                  fill="#4285F4"
                />
                <path
                  d="M12.24 23.5c3.16 0 5.81-1.04 7.75-2.83l-3.69-2.86c-.99.69-2.32 1.18-4.06 1.18-3.1 0-5.73-2.03-6.68-4.84l-.12.01-3.62 2.78-.04.11c1.93 3.83 5.91 6.45 10.46 6.45Z"
                  fill="#34A853"
                />
                <path
                  d="M5.56 14.15c-.25-.73-.4-1.5-.4-2.3 0-.8.14-1.57.39-2.3l-.01-.16L1.88 6.56l-.12.06A11.73 11.73 0 0 0 .5 11.85c0 1.88.45 3.66 1.26 5.23l3.8-2.93Z"
                  fill="#FBBC05"
                />
                <path
                  d="M12.24 4.73c2.05 0 3.43.88 4.22 1.62l3.08-3.01C18.04 1.97 15.4.5 12.24.5 7.7.5 3.72 3.11 1.79 6.94l3.76 2.91c.96-2.8 3.58-4.83 6.69-4.83Z"
                  fill="#EA4335"
                />
              </svg>
            </span>
            {loading ? "Connecting..." : "Continue with Google"}
          </button>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-300/60 bg-red-50/90 p-4 text-sm text-red-900">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
