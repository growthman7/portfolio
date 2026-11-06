const COOKIE = "pf_csrftoken";

export async function csrfToken() {
  const cookie = document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (cookie) return decodeURIComponent(cookie.slice(COOKIE.length + 1));
  const response = await fetch("/api/v1/auth/csrf/", { credentials: "same-origin" });
  return (await response.json()).csrf_token;
}
