/** Connexion et réinitialisation du mot de passe de l'administrateur (API /auth/). */
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { auth as authApi, errorMessage } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Loading } from "../ui.jsx";

function AuthCard({ title, lead, children, links }) {
  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__title">{title}</h1>
        {lead ? <p className="auth__lead">{lead}</p> : null}
        {children}
        <div className="auth__links">{links}</div>
      </div>
    </main>
  );
}

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef(null);

  useEffect(() => { document.title = "Connexion · Administration"; }, []);

  if (status === "loading") return <Loading full />;
  if (status === "authenticated") return <Navigate replace to={location.state?.from || "/"} />;

  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const username = form.username.value.trim();
    const password = form.password.value;
    setError("");
    if (!username || !password) {
      setError("Saisissez votre identifiant et votre mot de passe.");
      return;
    }
    setBusy(true);
    try {
      await login(username, password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err.status === 403 ? "Session expirée : rechargez la page puis réessayez." : errorMessage(err));
      form.password.value = "";
      passwordRef.current?.focus();
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Connexion"
      lead="Espace d'administration du portfolio."
      links={<><a href="/">← Retour au site</a><Link to="/reinitialisation">Mot de passe oublié ?</Link></>}
    >
      <form className="form" noValidate onSubmit={submit}>
        <div className="field">
          <label htmlFor="username">Identifiant</label>
          <input className="input" id="username" name="username" autoComplete="username" required maxLength={150} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} ref={passwordRef} />
        </div>
        {error ? <p className="alert alert--error" role="alert">{error}</p> : null}
        <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
      </form>
    </AuthCard>
  );
}

export function PasswordResetPage() {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Mot de passe · Administration"; }, []);

  const run = async (action) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      const detail = error.data?.new_password ? [].concat(error.data.new_password).join(" ") : errorMessage(error);
      setMessage({ type: "error", text: error.status === 404 ? "La réinitialisation par e-mail est désactivée." : detail });
    } finally {
      setBusy(false);
    }
  };

  const requestLink = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.email.value.trim();
    if (!email) return setMessage({ type: "error", text: "Saisissez une adresse e-mail." });
    return run(async () => {
      const data = await authApi.requestReset(email);
      setMessage({ type: "info", text: data.detail });
      form.reset();
    });
  };

  const confirm = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const password = form.new_password.value;
    if (password !== form.confirm_password.value) return setMessage({ type: "error", text: "Les deux mots de passe ne correspondent pas." });
    return run(async () => {
      const data = await authApi.confirmReset(uid, token, password);
      setMessage({ type: "info", text: data.detail });
      form.reset();
      setTimeout(() => navigate("/connexion", { replace: true }), 2500);
    });
  };

  const feedback = message ? <p className={`alert alert--${message.type}`} role="status">{message.text}</p> : null;
  const links = <Link to="/connexion">← Retour à la connexion</Link>;

  if (uid && token) {
    return (
      <AuthCard title="Mot de passe" lead="Choisissez un nouveau mot de passe (14 caractères minimum)." links={links}>
        <form className="form" noValidate onSubmit={confirm}>
          <div className="field">
            <label htmlFor="new_password">Nouveau mot de passe</label>
            <input className="input" id="new_password" name="new_password" type="password" autoComplete="new-password" required minLength={14} maxLength={256} />
          </div>
          <div className="field">
            <label htmlFor="confirm_password">Confirmation</label>
            <input className="input" id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required />
          </div>
          {feedback}
          <button className="btn btn--primary" type="submit" disabled={busy}>Enregistrer</button>
        </form>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="Mot de passe"
      lead="Indiquez l'adresse e-mail du compte administrateur. Si elle correspond, un lien valable 30 minutes vous sera envoyé."
      links={links}
    >
      <form className="form" noValidate onSubmit={requestLink}>
        <div className="field">
          <label htmlFor="email">Adresse e-mail</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
        </div>
        {feedback}
        <button className="btn btn--primary" type="submit" disabled={busy}>Envoyer le lien</button>
      </form>
    </AuthCard>
  );
}
