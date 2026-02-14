"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function firstToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim().split(/\s+/)[0];
  return token || null;
}

function getUserFirstName(user: User | null): string | null {
  if (!user) return null;

  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const fromGivenName = firstToken(metadata?.given_name);
  if (fromGivenName) return fromGivenName;

  const fromFullName = firstToken(metadata?.full_name);
  if (fromFullName) return fromFullName;

  const fromName = firstToken(metadata?.name);
  if (fromName) return fromName;

  const fromEmail = firstToken(user.email?.split("@")[0]);
  if (fromEmail) return fromEmail;

  return null;
}

export default function AccountPill() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [expanded, setExpanded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(() => !supabase);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setUser(data.user ?? null);
      setLoaded(true);
    };

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      setLoaded(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const firstName = getUserFirstName(user);
  const signedInLabel = firstName ? `Hi, ${firstName}` : "Signed in";
  const statusLabel = loaded
    ? user
      ? signedInLabel
      : "Not signed in"
    : "Checking...";
  const avatarText = user?.email?.charAt(0).toUpperCase() ?? "?";

  const handleSignOut = async () => {
    if (!supabase || signingOut) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="account-pill-wrap">
      <button
        type="button"
        className="account-pill-collapsed"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-label="Toggle account menu"
      >
        <span className="account-pill-avatar">{avatarText}</span>
        <span>{statusLabel}</span>
      </button>

      {expanded ? (
        <div className="account-pill-panel" role="dialog" aria-label="Account menu">
          <p className="account-pill-status">{user ? signedInLabel : "Not signed in"}</p>
          <p className="account-pill-email">{user?.email ?? "No active session."}</p>

          {user ? (
            <div className="account-pill-actions">
              <button
                type="button"
                onClick={handleSignOut}
                className="account-pill-signout"
                disabled={signingOut}
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          ) : (
            <div className="account-pill-actions">
              <Link href="/login" className="account-pill-link">
                Sign in
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
