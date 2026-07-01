"use client";

import { CalendarDays, LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function AdminLoginPage() {
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");

    if (password.trim().toLowerCase() !== "admin") {
      setError("Use password: admin");
      return;
    }

    window.localStorage.setItem("schedule-admin", "true");
    window.location.href = `${basePath}/admin/`;
  }

  return (
    <main className="loginShell">
      <section className="loginPanel">
        <div className="brandMark">
          <CalendarDays size={24} />
        </div>
        <p className="eyebrow">Restricted access</p>
        <h1>Admin schedule control</h1>
        <p>
          Sign in to create schedules, edit training details, block unavailable dates,
          and reschedule programs.
        </p>
        <form onSubmit={submit}>
          <label>
            Password
            <input name="password" type="password" placeholder="admin" />
          </label>
          {error ? <div className="alert compactAlert">{error}</div> : null}
          <button className="primary" type="submit">
            <LockKeyhole size={18} />
            Continue to admin
          </button>
        </form>
      </section>
    </main>
  );
}
