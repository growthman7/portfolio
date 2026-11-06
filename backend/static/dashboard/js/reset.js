import { request, prefix } from "./core/api.js";
import { $ } from "./core/dom.js";

function show(form, text, type) {
  const box = $("[data-message]", form);
  box.className = `alert alert--${type}`;
  box.textContent = text;
  box.hidden = false;
}

const requestForm = $("[data-reset-request]");
requestForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = requestForm.email.value.trim();
  if (!email) return show(requestForm, "Saisissez une adresse e-mail.", "error");
  try {
    const data = await request("/auth/password/reset/", { method: "POST", body: { email }, redirectOnAuth: false });
    show(requestForm, data.detail, "info");
    requestForm.reset();
  } catch (error) {
    show(requestForm, error.message, "error");
  }
});

const confirmForm = $("[data-reset-confirm]");
confirmForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = confirmForm.new_password.value;
  if (password !== confirmForm.confirm_password.value) return show(confirmForm, "Les deux mots de passe ne correspondent pas.", "error");
  try {
    const data = await request("/auth/password/reset/confirm/", {
      method: "POST",
      body: { uid: confirmForm.dataset.uid, token: confirmForm.dataset.token, new_password: password },
      redirectOnAuth: false,
    });
    show(confirmForm, data.detail, "info");
    confirmForm.reset();
    setTimeout(() => window.location.assign(`${prefix}connexion/`), 2500);
  } catch (error) {
    const messages = error.data?.new_password ? [].concat(error.data.new_password).join(" ") : error.message;
    show(confirmForm, messages, "error");
  }
});
