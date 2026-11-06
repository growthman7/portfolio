import { request, prefix } from "./core/api.js";
import { $ } from "./core/dom.js";

const form = $("[data-login-form]");
const error = $("[data-error]", form);
const submit = $("button[type=submit]", form);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.hidden = true;
  if (!form.username.value.trim() || !form.password.value) {
    error.textContent = "Saisissez votre identifiant et votre mot de passe.";
    error.hidden = false;
    return;
  }
  submit.disabled = true;
  submit.textContent = "Connexion…";
  try {
    await request("/auth/login/", { method: "POST", body: { username: form.username.value.trim(), password: form.password.value }, redirectOnAuth: false });
    window.location.assign(prefix);
  } catch (err) {
    error.textContent = err.status === 403 ? "Session expirée : rechargez la page puis réessayez." : err.message;
    error.hidden = false;
    form.password.value = "";
    form.password.focus();
  } finally {
    submit.disabled = false;
    submit.textContent = "Se connecter";
  }
});
