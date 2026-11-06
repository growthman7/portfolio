/** Jeton CSRF de Django : lu dans le cookie (même origine) ou demandé à l'API. */
const COOKIE = "pf_csrftoken";

export async function csrfToken() {
  const entry = document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (entry) return decodeURIComponent(entry.slice(COOKIE.length + 1));
  const response = await fetch("/api/v1/auth/csrf/", { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("csrf");
  return (await response.json()).csrf_token;
}
