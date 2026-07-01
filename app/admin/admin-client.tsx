"use client";

import { useEffect, useState } from "react";
import { SchedulePage } from "@/components/SchedulePage";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function AdminClient() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem("schedule-admin") === "true") {
      setAllowed(true);
      return;
    }

    window.location.replace(`${basePath}/admin/login/`);
  }, []);

  if (!allowed) {
    return (
      <main className="loginShell">
        <section className="loginPanel">
          <p className="eyebrow">Checking access</p>
          <h1>Redirecting to admin login</h1>
        </section>
      </main>
    );
  }

  return <SchedulePage lockedRole="admin" />;
}
