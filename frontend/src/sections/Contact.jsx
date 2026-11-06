import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { api, ApiError } from "../api/client.js";
import { useLang } from "../i18n/LanguageContext.jsx";
import { Icon, TitleParts } from "../components/ui.jsx";
import { phoneLinks, safeUrl } from "../utils/format.js";

const ORDER = ["linkedin", "github"];
const ICONS = { linkedin: "linkedin", github: "github" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Règles alignées sur le serveur (qui revalide tout) : confort de saisie uniquement. */
const RULES = {
  name: { min: 2, max: 100 },
  email: { max: 254, email: true },
  subject: { min: 3, max: 150 },
  message: { min: 10, max: 5000 },
};
const EMPTY = { name: "", email: "", subject: "", message: "", website: "", consent: false };

function validate(name, value, f) {
  if (name === "consent") return value ? "" : f.consentError;
  const rule = RULES[name];
  if (!rule) return "";
  const text = value.trim();
  if (!text) return f.required;
  if (rule.email && !EMAIL.test(text)) return f.invalidEmail;
  if (rule.min && text.length < rule.min) return f.min(rule.min);
  if (rule.max && text.length > rule.max) return f.max(rule.max);
  return "";
}

function CopyButton({ text }) {
  const { t } = useLang();
  const [label, setLabel] = useState(t.form.copy);
  const ref = useRef(null);
  useEffect(() => {
    if (label === t.form.copy) return undefined;
    const timer = setTimeout(() => setLabel(t.form.copy), 2200);
    return () => clearTimeout(timer);
  }, [label, t.form.copy]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setLabel(t.form.copied);
    } catch {
      // Copie refusée : on sélectionne l'adresse pour une copie manuelle.
      const range = document.createRange();
      range.selectNodeContents(ref.current.previousElementSibling);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      setLabel(t.form.selected);
    }
  };
  return (
    <button className="channel__action" type="button" ref={ref} aria-label={`${t.form.copy} ${text}`} onClick={copy}>
      <Icon name="copy" /><span>{label}</span>
    </button>
  );
}

function Channels({ profile }) {
  const { t } = useLang();
  if (!profile) return null;
  const links = [...(profile.social_links || [])]
    .sort((a, b) => {
      const ia = ORDER.indexOf(a.platform);
      const ib = ORDER.indexOf(b.platform);
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
    })
    .map((link) => ({ ...link, url: safeUrl(link.url) }))
    .filter((link) => link.url);
  const phone = phoneLinks(profile.phone);
  if (!profile.email && !phone && !links.length) return null;
  return (
    <div className="contact__channels-block">
      <p className="contact__channels-title mono">{t.contact.channels}</p>
      <div className="contact__channels">
        {profile.email ? (
          <div className="channel">
            <span className="channel__key"><Icon name="mail" />email</span>
            <a className="channel__value" href={`mailto:${profile.email}`}>{profile.email}</a>
            <CopyButton text={profile.email} />
          </div>
        ) : null}
        {phone ? (
          <div className="channel">
            <span className="channel__key"><Icon name="phone" />{t.contact.phone}</span>
            <a className="channel__value" href={phone.tel} aria-label={`${t.form.call} ${profile.phone}`}>{profile.phone}</a>
            <span className="channel__actions">
              <CopyButton text={profile.phone} />
              <a className="channel__action" href={phone.whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${profile.phone} (${t.openNewTab})`}>
                WhatsApp<Icon name="arrow" />
              </a>
            </span>
          </div>
        ) : null}
        {links.map((link) => (
          <div className="channel" key={link.url}>
            <span className="channel__key"><Icon name={ICONS[link.platform] || "link"} />{link.platform}</span>
            <a className="channel__value" href={link.url} target="_blank" rel="noopener noreferrer">{link.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>
            <a className="channel__action" href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`${link.label} (${t.openNewTab})`}>{t.form.open}<Icon name="arrow" /></a>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ name, label, error, children }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={`cf-${name}`}>{label} <span className="req" aria-hidden="true">*</span></label>
      {children}
      <div className="field__foot"><p className="field__error" id={`cf-${name}-err`}>{error}</p></div>
    </div>
  );
}

/**
 * Formulaire de contact : validé dans le navigateur, puis POST /api/v1/contact/ avec le jeton CSRF,
 * un jeton horodaté signé (GET /api/v1/contact/token/) et un champ piège ; l'API limite le débit.
 */
function ContactForm() {
  const { lang, t, routes } = useLang();
  const f = t.form;
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState(null); // prénom affiché après l'envoi (chaîne vide possible)
  const token = useRef(null);
  const formRef = useRef(null);
  const successRef = useRef(null);

  const refreshToken = () => { token.current = api.contactToken().catch(() => null); };
  useEffect(refreshToken, []);
  useEffect(() => { if (sentTo !== null) successRef.current?.focus(); }, [sentTo]);

  const update = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: validate(name, value, f) })); // correction en direct
  };
  const blur = (name) => {
    const value = values[name];
    if (value || name === "consent") setErrors((e) => ({ ...e, [name]: validate(name, value, f) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setStatus("");
    const found = Object.fromEntries(["name", "email", "subject", "message", "consent"].map((n) => [n, validate(n, values[n], f)]));
    setErrors(found);
    const first = Object.keys(found).find((n) => found[n]);
    if (first) {
      setStatus(f.invalid);
      formRef.current?.elements[first]?.focus();
      return;
    }
    setSending(true);
    try {
      const signed = await token.current;
      await api.sendContact({
        name: values.name.trim(),
        email: values.email.trim(),
        subject: values.subject.trim(),
        message: values.message.trim(),
        language: lang,
        consent: values.consent,
        website: values.website,
        form_token: signed?.form_token || "",
      });
      setSentTo(values.name.trim().split(/\s+/)[0] || "");
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setErrors(Object.fromEntries(Object.entries(error.data).filter(([k]) => k in EMPTY).map(([k, v]) => [k, [].concat(v)[0]])));
        setStatus(f.invalid);
      } else if (error instanceof ApiError && error.status === 429) setStatus(f.throttled);
      else if (error instanceof ApiError && error.status === 0) setStatus(f.network);
      else setStatus(f.server);
    } finally {
      setSending(false);
      refreshToken(); // un jeton par envoi
    }
  };

  const again = () => {
    setValues(EMPTY);
    setErrors({});
    setSentTo(null);
    requestAnimationFrame(() => formRef.current?.elements.name?.focus());
  };

  if (sentTo !== null) {
    return (
      <div className="form-success" role="status" tabIndex={-1} ref={successRef}>
        <p className="form-success__prompt"><span>$ </span>{f.command}<span> ✓</span></p>
        <h3 className="form-success__title">{f.successTitle(sentTo)}</h3>
        <p className="form-success__text">{f.successText}</p>
        <button className="btn" type="button" onClick={again}>{f.again}</button>
      </div>
    );
  }

  const input = (name, extra) => ({
    className: "field__input", id: `cf-${name}`, name, required: true,
    value: values[name], onChange: (e) => update(name, e.target.value), onBlur: () => blur(name),
    "aria-invalid": errors[name] ? "true" : "false", "aria-describedby": `cf-${name}-err`, ...extra,
  });

  return (
    <form className="form" ref={formRef} noValidate onSubmit={submit}>
      <div className="form__row form__row--2">
        <Field name="name" label={f.name} error={errors.name}><input type="text" autoComplete="name" minLength={2} maxLength={100} {...input("name")} /></Field>
        <Field name="email" label={f.email} error={errors.email}><input type="email" autoComplete="email" maxLength={254} {...input("email")} /></Field>
      </div>
      <Field name="subject" label={f.subject} error={errors.subject}><input type="text" minLength={3} maxLength={150} {...input("subject")} /></Field>
      <div className="field">
        <label className="field__label" htmlFor="cf-message">{f.message} <span className="req" aria-hidden="true">*</span></label>
        <textarea minLength={10} maxLength={5000} {...input("message", { "aria-describedby": "cf-message-err cf-message-count" })} />
        <div className="field__foot">
          <p className="field__error" id="cf-message-err">{errors.message}</p>
          <span className="field__count" id="cf-message-count">{values.message.length} / 5000</span>
        </div>
      </div>
      {/* Champ piège : invisible pour les humains, rempli par les robots. */}
      <div className="hp-field" aria-hidden="true">
        <label htmlFor="cf-website">{f.honeypot}</label>
        <input id="cf-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => update("website", e.target.value)} />
      </div>
      <div className="field">
        <label className="check">
          <input
            type="checkbox" name="consent" required checked={values.consent}
            onChange={(e) => update("consent", e.target.checked)} onBlur={() => blur("consent")}
            aria-invalid={errors.consent ? "true" : "false"} aria-describedby="cf-consent-err"
          />
          <span>{f.consent[0]}<Link to={routes.privacy}>{f.consent[1]}</Link>{f.consent[2]}</span>
        </label>
        <div className="field__foot"><p className="field__error" id="cf-consent-err">{errors.consent}</p></div>
      </div>
      <p className="form-status form-status--error" role="alert" hidden={!status}>{status}</p>
      <div className="form__actions">
        <button className={`btn btn--primary${sending ? " is-loading" : ""}`} type="submit" aria-busy={sending || undefined} disabled={sending}>
          {f.submit} <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}

export function Contact({ profile }) {
  const { t, routes } = useLang();
  return (
    <section className="section" id={routes.sections.contact} data-track aria-labelledby="t-contact">
      <div className="container">
        <p className="section__label mono">05 — {t.contact.label}</p>
        <div className="contact__grid">
          <div data-reveal="">
            <h2 className="contact__title" id="t-contact"><TitleParts parts={t.contact.title} /></h2>
            <p className="contact__intro">{t.contact.intro}</p>
            <Channels profile={profile} />
          </div>
          <div className="contact__panel" data-reveal="">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
