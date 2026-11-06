/**
 * Écrans génériques « liste + formulaire » pour une ressource de l'API d'administration.
 *
 * config = {
 *   endpoint: "/admin/skills/",      route: "/skills/skills" (chemin de la page, sans le préfixe),
 *   title, subtitle, singular, addLabel, emptyText,
 *   labelOf(item), defaults, loadOptions(), schema(options, item), columns: [{ label, render(item) }],
 *   After?: composant affiché sous le formulaire d'un élément existant (fichiers, galerie…)
 * }
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, errorMessage, getAll } from "./api.js";
import { SchemaForm } from "./forms.jsx";
import { Empty, ErrorAlert, Loading, PageHead, useToast } from "./ui.jsx";

function PublishToggle({ config, item, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (typeof item.is_published !== "boolean") return null;
  const label = item.is_published ? "Dépublier" : "Publier";
  const toggle = async () => {
    setBusy(true);
    try {
      await api.patch(`${config.endpoint}${item.id}/`, { is_published: !item.is_published });
      toast(item.is_published ? "Élément retiré du site." : "Élément publié sur le site.");
      onDone();
    } catch (error) {
      toast(errorMessage(error), "error");
      setBusy(false);
    }
  };
  return (
    <button className={`btn btn--small btn--ghost${item.is_published ? "" : " btn--publish"}`} type="button" disabled={busy}
      onClick={toggle} aria-label={`${label} « ${config.labelOf(item)} »`}>{label}</button>
  );
}

export function CrudList({ config, query = "", toolbar = null, title = config.title, subtitle = config.subtitle }) {
  const toast = useToast();
  const [state, setState] = useState({ status: "loading", items: [], error: null });

  const load = useCallback(async () => {
    try {
      setState({ status: "ready", items: await getAll(`${config.endpoint}${query}`), error: null });
    } catch (error) {
      setState({ status: "error", items: [], error });
    }
  }, [config.endpoint, query]);

  useEffect(() => {
    setState((s) => ({ ...s, status: "loading" }));
    load();
  }, [load]);

  const remove = async (item) => {
    if (!window.confirm(`Supprimer définitivement « ${config.labelOf(item)} » ?`)) return;
    try {
      await api.delete(`${config.endpoint}${item.id}/`);
      toast("Élément supprimé.");
      load();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  let body;
  if (state.status === "loading") body = <Loading />;
  else if (state.status === "error") body = <ErrorAlert>{errorMessage(state.error)}</ErrorAlert>;
  else if (!state.items.length) body = <Empty>{config.emptyText || "Aucun élément pour le moment."}</Empty>;
  else {
    body = (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {config.columns.map((c) => <th key={c.label} scope="col">{c.label}</th>)}
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((item) => (
              <tr key={item.id}>
                {config.columns.map((column, index) => (
                  <td key={column.label} data-label={column.label}>
                    {index === 0 ? <Link className="row-link" to={`${config.route}/${item.id}`}>{column.render(item)}</Link> : column.render(item)}
                  </td>
                ))}
                <td className="actions">
                  <PublishToggle config={config} item={item} onDone={load} />{" "}
                  <Link className="btn btn--small" to={`${config.route}/${item.id}`}>Modifier</Link>{" "}
                  <button className="btn btn--small btn--danger" type="button" onClick={() => remove(item)}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <PageHead title={title} subtitle={subtitle}>
        <Link className="btn btn--primary" to={`${config.route}/new`}>+ {config.addLabel || "Ajouter"}</Link>
      </PageHead>
      {toolbar}
      {body}
    </>
  );
}

export function CrudEdit({ config, id }) {
  const isNew = id === "new";
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", item: null, options: {}, error: null });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      isNew ? Promise.resolve({ ...(config.defaults || {}) }) : api.get(`${config.endpoint}${id}/`),
      config.loadOptions ? config.loadOptions() : Promise.resolve({}),
    ]).then(
      ([item, options]) => !cancelled && setState({ status: "ready", item, options, error: null }),
      (error) => !cancelled && setState({ status: "error", item: null, options: {}, error })
    );
    return () => { cancelled = true; };
  }, [config, id, isNew]);

  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return <ErrorAlert>{errorMessage(state.error)}</ErrorAlert>;

  const { item, options } = state;
  const save = async (data) => {
    if (isNew) {
      const saved = await api.post(config.endpoint, data);
      navigate(`${config.route}/${saved.id}`, { replace: true });
    } else {
      const saved = await api.patch(`${config.endpoint}${id}/`, data);
      setState((s) => ({ ...s, item: { ...s.item, ...saved } }));
    }
  };
  const After = config.After;

  return (
    <>
      <PageHead title={isNew ? `Nouveau : ${config.singular}` : config.labelOf(item)} subtitle={isNew ? "" : config.singular}>
        <Link className="btn btn--ghost" to={config.route}>← Retour à la liste</Link>
      </PageHead>
      <SchemaForm sections={config.schema(options, item)} initial={item} submitLabel={isNew ? "Créer" : "Enregistrer"} onSubmit={save}
        successMessage={isNew ? "Élément créé." : "Modifications enregistrées."} />
      {!isNew && After ? <After item={item} options={options} /> : null}
    </>
  );
}
