import { useEffect, useState } from "react";
import { api, auth, errorMessage } from "../api.js";
import { useAuth } from "../auth.jsx";
import { SchemaForm } from "../forms.jsx";
import { Empty, ErrorAlert, Loading, PageHead, fmtDateTime } from "../ui.jsx";

const passwordSchema = [
  {
    title: "Changer le mot de passe",
    help: "14 caractères minimum. Les autres sessions ouvertes seront déconnectées.",
    fields: [
      { name: "current_password", label: "Mot de passe actuel", type: "password", required: true, autoComplete: "current-password" },
      { name: "new_password", label: "Nouveau mot de passe", type: "password", required: true, autoComplete: "new-password" },
    ],
  },
];

function AuditLog() {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    api.get("/admin/audit-log/?page_size=50").then((data) => setState({ status: "ready", data }), (error) => setState({ status: "error", error }));
  }, []);

  let body;
  if (state.status === "loading") body = <Loading />;
  else if (state.status === "error") body = <ErrorAlert>{errorMessage(state.error)}</ErrorAlert>;
  else if (!state.data.results.length) body = <Empty>Aucun événement.</Empty>;
  else {
    body = (
      <div className="table-wrap">
        <table>
          <thead><tr>{["Date", "Action", "Compte", "Cible"].map((l) => <th key={l} scope="col">{l}</th>)}</tr></thead>
          <tbody>
            {state.data.results.map((e) => (
              <tr key={e.id}>
                <td className="mono" data-label="Date">{fmtDateTime(e.created_at)}</td>
                <td data-label="Action">{e.action_label}</td>
                <td data-label="Compte">{e.actor || "—"}</td>
                <td data-label="Cible">{e.target_label || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <section className="form-section"><h2>Journal d'audit</h2>{body}</section>;
}

export function SecurityPage() {
  const { user } = useAuth();
  const [formKey, setFormKey] = useState(0);
  const change = async (data) => {
    await auth.changePassword(data.current_password, data.new_password);
    setFormKey((k) => k + 1); // vide les champs
  };
  return (
    <>
      <PageHead title="Sécurité" subtitle="Compte, mot de passe et journal des opérations sensibles." />
      <div className="grid">
        <section className="card">
          <h2 className="card__title">Compte connecté</h2>
          <dl className="meta-list">
            <dt>Identifiant</dt><dd>{user?.username}</dd>
            <dt>E-mail</dt><dd>{user?.email || "—"}</dd>
            <dt>Dernière connexion</dt><dd>{fmtDateTime(user?.last_login)}</dd>
          </dl>
        </section>
        <SchemaForm key={formKey} sections={passwordSchema} submitLabel="Mettre à jour" onSubmit={change} successMessage="Mot de passe modifié." />
        <AuditLog />
      </div>
    </>
  );
}
