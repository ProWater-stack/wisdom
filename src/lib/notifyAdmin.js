export async function notifyAdminEmail({ apiOrigin, authHeaders, to, type, payload }) {
  try {
    await fetch(`${apiOrigin}/admin/notify-failure`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ to, type, payload }),
    });
  } catch (e) {
    console.warn("Email notify failed (best-effort):", e.message);
  }
}