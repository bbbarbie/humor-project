"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type TransitionClientProps = {
  email: string | null;
};

const REDIRECT_DELAY_MS = 900;

export default function TransitionClient({ email }: TransitionClientProps) {
  const router = useRouter();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      router.replace("/list");
    }, REDIRECT_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [router]);

  return (
    <div className="glass-page -mx-6 -my-8 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 md:-mx-10 md:px-10">
      <div className="w-full max-w-[760px]">
        <div className="glass-header text-center sm:text-left">
          <p className="glass-eyebrow">Protected</p>
          <h1 className="text-3xl sm:text-4xl">Access granted.</h1>
          {email ? (
            <p className="text-sm sm:text-base">
              Signed in as <span className="font-semibold">{email}</span>.
            </p>
          ) : (
            <p className="text-sm sm:text-base">
              Session confirmed. Preparing your gallery.
            </p>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
            <span>Initializing</span>
            <span>Secure</span>
          </div>
          <div className="access-progress mt-4">
            <div className="access-progress__bar" />
          </div>
          <p className="mt-4 text-xs text-white/55">
            Decrypting archive nodes…
          </p>
        </div>
      </div>
    </div>
  );
}
