import { api, ApiError } from "../core/api.js";
import { fmtDateTime, h } from "../core/dom.js";
import { buildForm } from "../core/forms.js";
import { errorMessage, loading, pageHead, toast } from "../core/ui.js";

export async function security(view) {
  const form = buildForm(
    [
      {
        title: "Changer le mot de passe",
        help: "14 caractères minimum. Les autres sessions ouvertes seront déconnectées.",
        fields: [
          { name: "current_password", label: "Mot de passe actuel", type: "password", required: true },
          { name: "new_password", label: "Nouveau mot de passe", type: "password", required: true },
        ],
      },
    ],
    {},
    {
      submitLabel: "Mettre à jour",
      onSubmit: async (data, formApi) => {
        try {
          await api.post("/auth/password/change/", data);
          formApi.element.reset();
          toast("Mot de passe modifié.");
        } catch (error) {
          if (error instanceof ApiError && error.status === 400) formApi.setErrors(error.data);
          toast(errorMessage(error), "error");
        }
      },
    }
  );
  form.element.querySelectorAll("input[type=password]").forEach((input, index) => input.setAttribute("autocomplete", index === 0 ? "current-password" : "new-password"));

  const journal = h("section", { class: "form-section" }, h("h2", { text: "Journal d'audit" }), loading());
  view.replaceChildren(pageHead("Sécurité", "Mot de passe et journal des opérations sensibles."), form.element, journal);
  try {
    const data = await api.get("/admin/audit-log/?page_size=50");
    journal.lastChild.replaceWith(
      data.results.length
        ? h(
            "div",
            { class: "table-wrap" },
            h(
              "table",
              {},
              h("thead", {}, h("tr", {}, ["Date", "Action", "Compte", "Cible"].map((label) => h("th", { scope: "col", text: label })))),
              h("tbody", {}, data.results.map((e) => h("tr", {}, h("td", { class: "mono", text: fmtDateTime(e.created_at), dataset: { label: "Date" } }), h("td", { text: e.action_label, dataset: { label: "Action" } }), h("td", { text: e.actor || "—", dataset: { label: "Compte" } }), h("td", { text: e.target_label || "—", dataset: { label: "Cible" } }))))
            )
          )
        : h("p", { class: "empty", text: "Aucun événement." })
    );
  } catch (error) {
    journal.lastChild.replaceWith(h("p", { class: "alert alert--error", text: errorMessage(error) }));
  }
}
