import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { api, errorMessage } from "../api.js";
import { Empty, ErrorAlert, Loading, PageHead, Tabs, fmtDateTime, useToast, useUnread } from "../ui.jsx";

const STATUSES = [["", "Tous"], ["new", "Nouveaux"], ["read", "Lus"], ["archived", "Archivés"], ["spam", "Indésirables"]];
const ACTIONS = [["read", "Marquer comme lu"], ["archived", "Archiver"], ["spam", "Indésirable"], ["new", "Marquer non lu"]];

const listPath = (status, page) => {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return `/messages${text ? `?${text}` : ""}`;
};

function MessageList() {
  const [params] = useSearchParams();
  const status = params.get("status") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    setState({ status: "loading" });
    const query = new URLSearchParams({ page: String(page) });
    if (status) query.set("status", status);
    api.get(`/admin/messages/?${query}`).then((data) => setState({ status: "ready", data }), (error) => setState({ status: "error", error }));
  }, [status, page]);

  let body;
  if (state.status === "loading") body = <Loading />;
  else if (state.status === "error") body = <ErrorAlert>{errorMessage(state.error)}</ErrorAlert>;
  else if (!state.data.results.length) body = <Empty>Aucun message.</Empty>;
  else {
    const { data } = state;
    body = (
      <div>
        <div className="table-wrap">
          <table>
            <thead><tr>{["Statut", "Objet", "Expéditeur", "Reçu le"].map((l) => <th key={l} scope="col">{l}</th>)}</tr></thead>
            <tbody>
              {data.results.map((m) => (
                <tr key={m.id}>
                  <td data-label="Statut">{m.status === "new" ? <span className="badge badge--new">Nouveau</span> : <span className="badge">{m.status_label}</span>}</td>
                  <td data-label="Objet"><Link className="row-link" to={`/messages/${m.id}`}>{m.subject}</Link></td>
                  <td data-label="Expéditeur">{m.name}</td>
                  <td data-label="Reçu le" className="mono">{fmtDateTime(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          {data.previous ? <Link className="btn btn--small" to={listPath(status, page - 1)}>← Précédents</Link> : <span />}
          <span className="mono">{data.count} message(s)</span>
          {data.next ? <Link className="btn btn--small" to={listPath(status, page + 1)}>Suivants →</Link> : <span />}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHead title="Messages" subtitle="Messages reçus via le formulaire de contact." />
      <Tabs items={STATUSES.map(([value, label]) => [listPath(value, 1), label])} current={listPath(status, 1)} />
      {body}
    </>
  );
}

function MessageDetail({ id }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { refresh: refreshUnread } = useUnread();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    api.get(`/admin/messages/${id}/`).then( // l'ouverture marque le message comme lu
      (message) => { setState({ status: "ready", message }); refreshUnread(); },
      (error) => setState({ status: "error", error })
    );
  }, [id, refreshUnread]);

  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return <ErrorAlert>{errorMessage(state.error)}</ErrorAlert>;
  const { message } = state;

  const setStatus = async (status) => {
    try {
      const updated = await api.patch(`/admin/messages/${id}/`, { status });
      setState({ status: "ready", message: updated });
      toast(`Message marqué « ${updated.status_label} ».`);
      refreshUnread();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };
  const remove = async () => {
    if (!window.confirm("Supprimer définitivement ce message ?")) return;
    try {
      await api.delete(`/admin/messages/${id}/`);
      toast("Message supprimé.");
      refreshUnread();
      navigate("/messages");
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };
  const mailto = `mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`;

  return (
    <>
      <PageHead title={message.subject} subtitle={`Reçu le ${fmtDateTime(message.created_at)}`}>
        <Link className="btn btn--ghost" to="/messages">← Messages</Link>
      </PageHead>
      <div className="grid">
        <section className="card">
          <dl className="meta-list">
            <dt>De</dt><dd>{message.name}</dd>
            <dt>E-mail</dt><dd>{message.email}</dd>
            <dt>Langue</dt><dd>{message.language.toUpperCase()}</dd>
            <dt>Statut</dt><dd>{message.status_label}</dd>
          </dl>
        </section>
        <div className="message-body">{message.message}</div>
        <div className="page-actions">
          <a className="btn btn--primary" href={mailto}>Répondre par e-mail</a>
          {ACTIONS.filter(([status]) => status !== message.status).map(([status, label]) => (
            <button key={status} className="btn btn--small" type="button" onClick={() => setStatus(status)}>{label}</button>
          ))}
          <button className="btn btn--danger" type="button" onClick={remove}>Supprimer</button>
        </div>
      </div>
    </>
  );
}

export function MessagesPage() {
  const { id } = useParams();
  return id ? <MessageDetail key={id} id={id} /> : <MessageList />;
}
