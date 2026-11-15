import { useCallback, useEffect, useState } from "react";
import { ApiError, api, errorMessage } from "../api.js";
import { useAuth } from "../auth.jsx";
import { SchemaForm } from "../forms.jsx";
import { Badge, Empty, ErrorAlert, Loading, PageHead, fmtDateTime, useToast } from "../ui.jsx";

const ENDPOINT = "/admin/admins/";
const MIN_PASSWORD = 14; // même seuil que la politique du serveur, qui reste seule juge

const schema = [
  {
    title: "Ajouter un administrateur",
    help: "L'adresse e-mail sert d'identifiant de connexion. Mot de passe : 14 caractères minimum, ni courant ni proche du nom.",
    fields: [
      { name: "last_name", label: "Nom", required: true, max: 150, autoComplete: "off" },
      { name: "first_name", label: "Prénom", required: true, max: 150, autoComplete: "off" },
      { name: "email", label: "Adresse e-mail", type: "email", required: true, max: 150, autoComplete: "off", wide: true },
      { name: "password", label: "Mot de passe", type: "password", required: true, max: 256, autoComplete: "new-password" },
      { name: "password_confirm", label: "Confirmation du mot de passe", type: "password", required: true, max: 256, autoComplete: "new-password" },
    ],
  },
];

/** Contrôles immédiats ; le serveur refait toutes les vérifications. */
function validate(data) {
  const errors = {};
  for (const name of ["last_name", "first_name", "email", "password", "password_confirm"]) {
    if (!String(data[name] || "").trim()) errors[name] = "Champ obligatoire.";
  }
  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) errors.email = "Adresse e-mail invalide.";
  if (!errors.password && data.password.length < MIN_PASSWORD) errors.password = `${MIN_PASSWORD} caractères minimum.`;
  if (!errors.password_confirm && data.password !== data.password_confirm) errors.password_confirm = "Les mots de passe ne correspondent pas.";
  if (Object.keys(errors).length) throw new ApiError(400, errors);
}

const fullName = (admin) => [admin.first_name, admin.last_name].filter(Boolean).join(" ") || admin.username;

export function AdminsPage() {
  const toast = useToast();
  const { refresh } = useAuth();
  const [state, setState] = useState({ status: "loading", items: [], error: null });
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setState({ status: "ready", items: await api.get(ENDPOINT), error: null });
    } catch (error) {
      setState({ status: "error", items: [], error });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (data) => {
    validate(data);
    await api.post(ENDPOINT, { ...data, last_name: data.last_name.trim(), first_name: data.first_name.trim(), email: data.email.trim() });
    setFormKey((k) => k + 1); // vide le formulaire : aucun mot de passe ne reste à l'écran
    load();
  };

  const remove = async (admin) => {
    const question = admin.is_self
      ? "Supprimer définitivement VOTRE compte ? Vous serez déconnecté immédiatement et ne pourrez plus vous connecter avec ces identifiants."
      : `Supprimer définitivement l'administrateur « ${fullName(admin)} » ?`;
    if (!window.confirm(question)) return;
    try {
      await api.delete(`${ENDPOINT}${admin.id}/`);
      toast(admin.is_self ? "Votre compte a été supprimé." : "Administrateur supprimé.");
      if (admin.is_self) await refresh(); // la session n'existe plus : retour à l'écran de connexion
      else load();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  const activeCount = state.items.filter((a) => a.is_active).length;
  let body;
  if (state.status === "loading") body = <Loading />;
  else if (state.status === "error") body = <ErrorAlert>{errorMessage(state.error)}</ErrorAlert>;
  else if (!state.items.length) body = <Empty>Aucun administrateur.</Empty>;
  else {
    body = (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {["Nom et prénom", "Adresse e-mail", "Créé le", "Statut"].map((l) => <th key={l} scope="col">{l}</th>)}
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((admin) => {
              const last = admin.is_active && activeCount === 1;
              return (
                <tr key={admin.id}>
                  <td data-label="Nom et prénom">{fullName(admin)} {admin.is_self ? <Badge kind="new">Vous</Badge> : null}</td>
                  <td data-label="Adresse e-mail">{admin.email || "—"}</td>
                  <td className="mono" data-label="Créé le">{fmtDateTime(admin.date_joined)}</td>
                  <td data-label="Statut"><Badge on={admin.is_active}>{admin.is_active ? "Actif" : "Désactivé"}</Badge></td>
                  <td className="actions">
                    <button className="btn btn--small btn--danger" type="button" disabled={last} onClick={() => remove(admin)}
                      title={last ? "Dernier administrateur actif : créez d'abord un autre compte." : undefined}
                      aria-label={`Supprimer ${fullName(admin)}`}>Supprimer</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <PageHead title="Administrateurs" subtitle="Comptes autorisés à gérer le portfolio. Il doit toujours rester au moins un administrateur actif." />
      <div className="grid">
        <section className="form-section"><h2>Comptes</h2>{body}</section>
        <SchemaForm key={formKey} sections={schema} submitLabel="Créer l'administrateur" onSubmit={create} successMessage="Administrateur créé." />
      </div>
    </>
  );
}
