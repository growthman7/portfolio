import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, errorMessage } from "../api.js";
import { ErrorAlert, Loading, PageHead, fmtDateTime } from "../ui.jsx";

function Stat({ value, label, alert = false }) {
  return (
    <div className={`card stat${alert ? " stat--alert" : ""}`}>
      <p className="stat__value">{value}</p>
      <p className="stat__label">{label}</p>
    </div>
  );
}

function Sparkline({ timeline, total }) {
  const max = Math.max(1, ...timeline.map((d) => d.count));
  return (
    <div className="sparkline" role="img" aria-label={`${total} messages sur 30 jours`}>
      {timeline.map((d) => (
        <span key={d.date} className={`sparkline__bar${d.count ? " sparkline__bar--on" : ""}`} title={`${d.date} : ${d.count}`}
          style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export function OverviewPage() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    api.get("/admin/dashboard/").then((data) => setState({ status: "ready", data }), (error) => setState({ status: "error", error }));
  }, []);

  let body;
  if (state.status === "loading") body = <Loading />;
  else if (state.status === "error") body = <ErrorAlert>{errorMessage(state.error)}</ErrorAlert>;
  else {
    const { data } = state;
    const career = data.career.experiences + data.career.educations + data.career.certifications + (data.career.achievements || 0);
    body = (
      <div className="grid">
        {data.projects.samples_published ? (
          <p className="alert alert--info">
            {data.projects.samples_published} projet(s) d'exemple sont publiés : remplacez-les par vos réalisations réelles ou dépubliez-les.
          </p>
        ) : null}
        <div className="grid grid--stats">
          <Stat value={data.projects.published} label="projets publiés" />
          <Stat value={data.projects.drafts} label="brouillons" />
          <Stat value={data.messages.new} label="messages non lus" alert={data.messages.new > 0} />
          <Stat value={data.skills.published} label="compétences publiées" />
          <Stat value={career} label="entrées de parcours" />
          <Stat value={data.security.failed_logins_7d} label="échecs de connexion (7 j)" alert={data.security.failed_logins_7d > 0} />
        </div>
        <div className="grid grid--2">
          <section className="card">
            <h2 className="card__title">Messages — 30 derniers jours</h2>
            <Sparkline timeline={data.messages.timeline} total={data.messages.last_30_days} />
            <p className="muted mono">{data.messages.last_30_days} reçus · {data.messages.total} au total</p>
            <ul className="activity">
              {data.messages.latest.length ? (
                data.messages.latest.map((m) => (
                  <li key={m.id}>
                    <Link className="row-link" to={`/messages/${m.id}`}>
                      {m.status === "new" ? <span className="badge badge--new">Nouveau</span> : null} {m.subject}
                    </Link>
                    <span className="muted mono">{fmtDateTime(m.created_at)}</span>
                  </li>
                ))
              ) : (
                <li className="muted">Aucun message pour le moment.</li>
              )}
            </ul>
          </section>
          <section className="card">
            <h2 className="card__title">Sécurité & activité récente</h2>
            <dl className="meta-list">
              <dt>Dernière connexion</dt><dd>{fmtDateTime(data.security.last_login)}</dd>
              <dt>Verrouillages (7 j)</dt><dd>{data.security.lockouts_7d}</dd>
              <dt>Spams bloqués (7 j)</dt><dd>{data.security.spam_blocked_7d}</dd>
            </dl>
            <ul className="activity">
              {data.recent_activity.map((entry) => (
                <li key={entry.id}>
                  <span>{entry.action_label}{entry.target_label ? ` — ${entry.target_label}` : ""}</span>
                  <span className="muted mono">{fmtDateTime(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHead title="Vue d'ensemble" subtitle="L'essentiel de votre portfolio en un coup d'œil." />
      {body}
    </>
  );
}
