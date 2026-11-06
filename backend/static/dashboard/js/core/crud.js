/**
 * Écrans génériques « liste + formulaire » pour une ressource de l'API d'administration.
 * Utilisés par les pages Projets, Compétences, Parcours, Taxonomie et Réseaux.
 */
import { api, ApiError, getAll } from "./api.js";
import { h } from "./dom.js";
import { buildForm } from "./forms.js";
import { confirmAction, errorMessage, loading, pageHead, toast } from "./ui.js";

/**
 * @param {object} config
 * @param {string} config.endpoint           ex. "/admin/skills/"
 * @param {string} config.route              ex. "#/skills"
 * @param {string} config.singular           libellé d'un élément
 * @param {{label: string, render: (item) => Node|string}[]} config.columns
 * @param {(options) => object[]} config.schema  sections du formulaire
 * @param {() => Promise<object>} [config.loadOptions] données pour les listes déroulantes
 * @param {(item, container, options) => void} [config.afterForm] contenu additionnel (fichiers…)
 */
export function crud(config) {
  /** Publication / dépublication en un clic, pour les ressources qui ont un statut de publication. */
  function publishToggle(item, refresh) {
    if (typeof item.is_published !== "boolean") return null;
    const button = h("button", {
      class: `btn btn--small btn--ghost${item.is_published ? "" : " btn--publish"}`, type: "button",
      text: item.is_published ? "Dépublier" : "Publier",
      "aria-label": `${item.is_published ? "Dépublier" : "Publier"} « ${config.labelOf(item)} »`,
    });
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await api.patch(`${config.endpoint}${item.id}/`, { is_published: !item.is_published });
        toast(item.is_published ? "Élément retiré du site." : "Élément publié sur le site.");
        refresh();
      } catch (error) {
        toast(errorMessage(error), "error");
        button.disabled = false;
      }
    });
    return [button, " "];
  }

  async function list(view, { title = config.title, subtitle = config.subtitle, query = "", toolbar = null } = {}) {
    view.replaceChildren(
      ...[pageHead(title, subtitle, h("a", { class: "btn btn--primary", href: `${config.route}/new`, text: `+ ${config.addLabel || "Ajouter"}` })), toolbar, loading()].filter(Boolean)
    );
    let items;
    try {
      items = await getAll(`${config.endpoint}${query}`);
    } catch (error) {
      view.lastChild.replaceWith(h("p", { class: "alert alert--error", text: errorMessage(error) }));
      return;
    }
    if (!items.length) {
      view.lastChild.replaceWith(h("p", { class: "empty", text: config.emptyText || "Aucun élément pour le moment." }));
      return;
    }
    const tbody = h("tbody");
    for (const item of items) {
      const remove = h("button", { class: "btn btn--small btn--danger", type: "button", text: "Supprimer" });
      remove.addEventListener("click", async () => {
        if (!confirmAction(`Supprimer définitivement « ${config.labelOf(item)} » ?`)) return;
        try {
          await api.delete(`${config.endpoint}${item.id}/`);
          toast("Élément supprimé.");
          list(view, { title, subtitle, query, toolbar });
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      });
      tbody.append(
        h(
          "tr",
          {},
          config.columns.map((column, index) =>
            h("td", { dataset: { label: column.label } }, index === 0 ? h("a", { class: "row-link", href: `${config.route}/${item.id}` }, column.render(item)) : column.render(item))
          ),
          h("td", { class: "actions" }, publishToggle(item, () => list(view, { title, subtitle, query, toolbar })), h("a", { class: "btn btn--small", href: `${config.route}/${item.id}`, text: "Modifier" }), " ", remove)
        )
      );
    }
    view.lastChild.replaceWith(
      h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, config.columns.map((c) => h("th", { scope: "col", text: c.label })), h("th", { scope: "col" }, h("span", { class: "visually-hidden", text: "Actions" })))), tbody))
    );
  }

  async function edit(view, id) {
    const isNew = id === "new";
    view.replaceChildren(loading());
    let item = {};
    let options = {};
    try {
      [item, options] = await Promise.all([
        isNew ? Promise.resolve(config.defaults ? { ...config.defaults } : {}) : api.get(`${config.endpoint}${id}/`),
        config.loadOptions ? config.loadOptions() : Promise.resolve({}),
      ]);
    } catch (error) {
      view.replaceChildren(h("p", { class: "alert alert--error", text: errorMessage(error) }));
      return;
    }

    const back = h("a", { class: "btn btn--ghost", href: config.route, text: "← Retour à la liste" });
    const form = buildForm(config.schema(options, item), item, {
      submitLabel: isNew ? "Créer" : "Enregistrer",
      onSubmit: async (data, formApi) => {
        try {
          const saved = isNew ? await api.post(config.endpoint, data) : await api.patch(`${config.endpoint}${id}/`, data);
          toast(isNew ? "Élément créé." : "Modifications enregistrées.");
          if (isNew) window.location.hash = `${config.route}/${saved.id}`;
          else Object.assign(item, saved);
        } catch (error) {
          if (error instanceof ApiError && error.status === 400) formApi.setErrors(error.data);
          toast(errorMessage(error), "error");
        }
      },
    });
    view.replaceChildren(pageHead(isNew ? `Nouveau : ${config.singular}` : config.labelOf(item), isNew ? "" : config.singular, back), form.element);
    if (!isNew && config.afterForm) config.afterForm(item, view, options);
  }

  return { list, edit };
}
