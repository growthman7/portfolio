import { api } from "../core/api.js";
import { fmtDateTime, h } from "../core/dom.js";
import { confirmAction, errorMessage, loading, pageHead, toast } from "../core/ui.js";
import { refreshUnread } from "../app.js";

const STATUSES = [["", "Tous"], ["new", "Nouveaux"], ["read", "Lus"], ["archived", "Archivés"], ["spam", "Indésirables"]];

async function list(view) {
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const status = params.get("status") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const tabs = h("div", { class: "tabs", role: "tablist" }, STATUSES.map(([value, label]) => h("a", { class: "tab", role: "tab", href: `#/messages${value ? `?status=${value}` : ""}`, "aria-selected": String(value === status), text: label })));
  view.replaceChildren(pageHead("Messages", "Messages reçus via le formulaire de contact."), tabs, loading());

  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set("status", status);
  let data;
  try {
    data = await api.get(`/admin/messages/?${query}`);
  } catch (error) {
    view.lastChild.replaceWith(h("p", { class: "alert alert--error", text: errorMessage(error) }));
    return;
  }
  if (!data.results.length) {
    view.lastChild.replaceWith(h("p", { class: "empty", text: "Aucun message." }));
    return;
  }
  const rows = data.results.map((m) =>
    h(
      "tr",
      {},
      h("td", { dataset: { label: "Statut" } }, m.status === "new" ? h("span", { class: "badge badge--new", text: "Nouveau" }) : h("span", { class: "badge", text: m.status_label })),
      h("td", { dataset: { label: "Objet" } }, h("a", { class: "row-link", href: `#/messages/${m.id}`, text: m.subject })),
      h("td", { text: m.name, dataset: { label: "Expéditeur" } }),
      h("td", { class: "mono", text: fmtDateTime(m.created_at), dataset: { label: "Reçu le" } })
    )
  );
  const pageLink = (target, label, enabled) =>
    enabled ? h("a", { class: "btn btn--small", href: `#/messages?${new URLSearchParams({ ...(status ? { status } : {}), page: String(target) })}`, text: label }) : h("span");
  view.lastChild.replaceWith(
    h(
      "div",
      {},
      h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, ["Statut", "Objet", "Expéditeur", "Reçu le"].map((label) => h("th", { scope: "col", text: label })))), h("tbody", {}, rows))),
      h("div", { class: "pagination" }, pageLink(page - 1, "← Précédents", Boolean(data.previous)), h("span", { class: "mono", text: `${data.count} message(s)` }), pageLink(page + 1, "Suivants →", Boolean(data.next)))
    )
  );
}

async function detail(view, id) {
  view.replaceChildren(loading());
  let message;
  try {
    message = await api.get(`/admin/messages/${id}/`); // l'ouverture marque le message comme lu
    refreshUnread();
  } catch (error) {
    view.replaceChildren(h("p", { class: "alert alert--error", text: errorMessage(error) }));
    return;
  }
  const setStatus = async (status) => {
    try {
      message = await api.patch(`/admin/messages/${id}/`, { status });
      toast(`Message marqué « ${message.status_label} ».`);
      refreshUnread();
      detail(view, id);
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };
  const remove = h("button", { class: "btn btn--danger", type: "button", text: "Supprimer" });
  remove.addEventListener("click", async () => {
    if (!confirmAction("Supprimer définitivement ce message ?")) return;
    await api.delete(`/admin/messages/${id}/`);
    toast("Message supprimé.");
    window.location.hash = "#/messages";
  });
  const actions = [["read", "Marquer comme lu"], ["archived", "Archiver"], ["spam", "Indésirable"], ["new", "Marquer non lu"]]
    .filter(([status]) => status !== message.status)
    .map(([status, label]) => {
      const button = h("button", { class: "btn btn--small", type: "button", text: label });
      button.addEventListener("click", () => setStatus(status));
      return button;
    });
  const mailto = `mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`;

  view.replaceChildren(
    pageHead(message.subject, `Reçu le ${fmtDateTime(message.created_at)}`, h("a", { class: "btn btn--ghost", href: "#/messages", text: "← Messages" })),
    h(
      "div",
      { class: "grid" },
      h(
        "section",
        { class: "card" },
        h("dl", { class: "meta-list" },
          h("dt", { text: "De" }), h("dd", { text: message.name }),
          h("dt", { text: "E-mail" }), h("dd", { text: message.email }),
          h("dt", { text: "Langue" }), h("dd", { text: message.language.toUpperCase() }),
          h("dt", { text: "Statut" }), h("dd", { text: message.status_label })
        )
      ),
      h("div", { class: "message-body", text: message.message }),
      h("div", { class: "page-actions" }, h("a", { class: "btn btn--primary", href: mailto, text: "Répondre par e-mail" }), actions, remove)
    )
  );
}

export function messages(view, id) {
  return id ? detail(view, id) : list(view);
}
