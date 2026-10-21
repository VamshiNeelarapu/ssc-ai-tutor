"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/contexts/AuthContext";

export function useAuth(redirectIfUnauthenticated = true) {
  const { user, loading, login, register, logout, refreshUser } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && redirectIfUnauthenticated) {
      router.push("/login");
    }
  }, [user, loading, redirectIfUnauthenticated, router]);

  return { user, loading, login, register, logout, refreshUser };
}

export default useAuth;
