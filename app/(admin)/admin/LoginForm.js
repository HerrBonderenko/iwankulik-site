"use client";
import { useState } from "react";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const login = form.get("login");
    const password = form.get("password");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
    if (res.ok) {
      location.reload();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error || "Невірний логін або пароль");
    setBusy(false);
  }

  return (
    <div className="admin-login">
      <form className="form" onSubmit={onSubmit}>
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>Вхід в адмінку</h1>
        <label>логін<input name="login" type="text" autoFocus autoComplete="username" /></label>
        <label>пароль<input name="password" type="password" autoComplete="current-password" /></label>
        <button type="submit" disabled={busy}>{busy ? "Перевіряю…" : "Увійти"}</button>
        {error && <span className="form-note">{error}</span>}
      </form>
    </div>
  );
}
