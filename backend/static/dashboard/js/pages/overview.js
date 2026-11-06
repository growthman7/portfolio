import { api } from "../core/api.js";
import { fmtDateTime, h } from "../core/dom.js";
import { errorMessage, loading, pageHead } from "../core/ui.js";

const stat = (value, label, alert = false) => h("div", { class: `card stat${alert ? " stat--alert" : ""}` }, h("p", { class: "stat__value", text: String(value) }), h("p", { class: "stat__label", text: label }));

export async function overview(view) {
  view.replaceChildren(pageHead("Vue d'ensemble", "L'essentiel de votre portfolio en un coup d'œil."), loading());
  let data;
  try {
    data = await api.get("/admin/dashboard/");
  } catch (error) {
    view.lastChild.replaceWith(h("p", { class: "alert alert--error", text: errorMessage(error) }));
    return;
  }
  const max = Math.max(1, ...data.messages.timeline.map((d) => d.count));
  const spark = h(
    "div",
    { class: "sparkline", role: "img", "aria-label": `${data.messages.last_30_days} messages sur 30 jours` },
    data.messages.timeline.map((d) => {
      const bar = h("span", { class: `sparkline__bar${d.count ? " sparkline__bar--on" : ""}`, title: `${d.date} : ${d.count}` });
      bar.style.height = `${Math.max(3, (d.count / max) * 100)}%`;
      return bar;
    })
  );

  view.lastChild.replaceWith(
    h(
      "div",
      { class: "grid" },
      data.projects.samples_published
        ? h("p", { class: "alert alert--info", text: `${data.projects.samples_published} projet(s) d'exemple sont publiés : remplacez-les par vos réalisations réelles ou dépubliez-les.` })
        : null,
      h(
        "div",
        { class: "grid grid--stats" },
        stat(data.projects.published, "projets publiés"),
        stat(data.projects.drafts, "brouillons"),
        stat(data.messages.new, "messages non lus", data.messages.new > 0),
        stat(data.skills.published, "compétences publiées"),
        stat(data.career.experiences + data.career.educations + data.career.certifications + (data.career.achievements || 0), "entrées de parcours"),
        stat(data.security.failed_logins_7d, "échecs de connexion (7 j)", data.security.failed_logins_7d > 0)
      ),
      h(
        "div",
        { class: "grid grid--2" },
        h(
          "section",
          { class: "card" },
          h("h2", { class: "card__title", text: "Messages — 30 derniers jours" }),
          spark,
          h("p", { class: "muted mono", text: `${data.messages.last_30_days} reçus · ${data.messages.total} au total` }),
          h(
            "ul",
            { class: "activity" },
            data.messages.latest.length
              ? data.messages.latest.map((m) =>
                  h("li", {}, h("a", { class: "row-link", href: `#/messages/${m.id}` }, m.status === "new" ? h("span", { class: "badge badge--new", text: "Nouveau" }) : null, " ", m.subject), h("span", { class: "muted mono", text: fmtDateTime(m.created_at) }))
                )
              : h("li", { class: "muted", text: "Aucun message pour le moment." })
          )
        ),
        h(
          "section",
          { class: "card" },
          h("h2", { class: "card__title", text: "Sécurité & activité récente" }),
          h(
            "dl",
            { class: "meta-list" },
            h("dt", { text: "Dernière connexion" }), h("dd", { text: fmtDateTime(data.security.last_login) }),
            h("dt", { text: "Verrouillages (7 j)" }), h("dd", { text: String(data.security.lockouts_7d) }),
            h("dt", { text: "Spams bloqués (7 j)" }), h("dd", { text: String(data.security.spam_blocked_7d) })
          ),
          h("ul", { class: "activity" }, data.recent_activity.map((entry) => h("li", {}, h("span", {}, entry.action_label, entry.target_label ? ` — ${entry.target_label}` : ""), h("span", { class: "muted mono", text: fmtDateTime(entry.created_at) }))))
        )
      )
    )
  );
}
