"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LoginPage } from "@/components/LoginPage";
import type { User } from "@/lib/types";

export default function LoginRoute() {
  const router = useRouter();

  const handleLoginSuccess = (user: User, token: string) => {
    router.push("/");
  };

  const handleContinueAsGuest = () => {
    router.push("/");
  };

  return (
    <LoginPage
      onLoginSuccess={handleLoginSuccess}
      onContinueAsGuest={handleContinueAsGuest}
    />
  );
}

