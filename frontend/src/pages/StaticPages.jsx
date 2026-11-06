import { Link } from "react-router";
import { SimpleLayout } from "../components/Layout.jsx";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { useLang } from "../i18n/LanguageContext.jsx";
import { ROUTES } from "../i18n/routes.js";

/** Contenu des pages légales. Complétez chaque élément « [À REMPLACER] » avant la mise en ligne. */
const LEGAL = {
  fr: {
    title: "Mentions légales",
    notice: "Contenu provisoire : complétez chaque élément marqué « [À REMPLACER] » avant la mise en ligne.",
    blocks: [
      ["Éditeur du site", "[À REMPLACER] Prénom Nom — [statut] — [ville, pays] — contact : [adresse e-mail]."],
      ["Hébergement", "[À REMPLACER] Nom, adresse et téléphone de l'hébergeur."],
      ["Propriété intellectuelle", "Les textes, visuels et réalisations présentés sur ce site appartiennent à leur auteur, sauf mention contraire. Toute reproduction ou réutilisation sans autorisation écrite est interdite."],
      ["Polices", "Instrument Serif, Geist et Geist Mono sont distribuées sous licence SIL Open Font License 1.1 et hébergées sur ce site."],
    ],
  },
  en: {
    title: "Legal notice",
    notice: "Placeholder content: complete every item marked “[TO REPLACE]” before going live.",
    blocks: [
      ["Publisher", "[TO REPLACE] First name Last name — [status] — [city, country] — contact: [email address]."],
      ["Hosting", "[TO REPLACE] Hosting provider name, address and phone."],
      ["Intellectual property", "Texts, visuals and work shown on this site belong to their author unless stated otherwise. Reproduction or reuse without written permission is prohibited."],
      ["Fonts", "Instrument Serif, Geist and Geist Mono are licensed under the SIL Open Font License 1.1 and self-hosted."],
    ],
  },
};

const PRIVACY = {
  fr: {
    title: "Confidentialité",
    notice: "Contenu provisoire : adaptez les éléments marqués « [À REMPLACER] ».",
    blocks: [
      ["Données collectées", "Seul le formulaire de contact recueille des données : nom, adresse e-mail, objet et message. L'adresse IP n'est jamais conservée en clair ; seule une empreinte pseudonymisée sert à limiter les abus."],
      ["Utilisation", "Ces données servent uniquement à répondre à votre demande. Elles ne sont ni vendues ni transmises."],
      ["Conservation", "Les messages sont conservés [À REMPLACER : 12 mois] après le dernier échange, puis supprimés."],
      ["Cookies", "Aucun cookie publicitaire ni outil de mesure d'audience. Un cookie technique de sécurité protège l'envoi du formulaire."],
      ["Vos droits", "Accès, rectification, effacement et opposition : écrivez à [À REMPLACER : adresse e-mail]."],
    ],
  },
  en: {
    title: "Privacy",
    notice: "Placeholder content: adapt the items marked “[TO REPLACE]”.",
    blocks: [
      ["Data collected", "Only the contact form collects data: name, email address, subject and message. IP addresses are never stored in clear text; only a pseudonymised fingerprint is kept to limit abuse."],
      ["Use", "This data is used only to answer your request. It is never sold or shared."],
      ["Retention", "Messages are kept for [TO REPLACE: 12 months] after the last exchange, then deleted."],
      ["Cookies", "No advertising cookies and no analytics. A technical security cookie protects the form."],
      ["Your rights", "Access, rectification, erasure and objection: write to [TO REPLACE: email address]."],
    ],
  },
};

function TextPage({ content }) {
  const { lang } = useLang();
  const page = content[lang];
  useDocumentTitle(page.title);
  return (
    <SimpleLayout>
      <h1>{page.title}</h1>
      <p className="notice">{page.notice}</p>
      {page.blocks.map(([heading, text]) => (
        <section key={heading}><h2>{heading}</h2><p>{text}</p></section>
      ))}
    </SimpleLayout>
  );
}

export const LegalPage = () => <TextPage content={LEGAL} />;
export const PrivacyPage = () => <TextPage content={PRIVACY} />;

export function NotFoundPage() {
  const { t } = useLang();
  useDocumentTitle(`${t.notFound.title.replace(/\.$/, "")} — 404`);
  return (
    <SimpleLayout brand={t.home}>
      <p className="mono">{t.notFound.command}<br /><span className="accent-red">{t.notFound.error}</span></p>
      <h1>{t.notFound.title}</h1>
      <p>{t.notFound.text}</p>
      <p><Link to={ROUTES.fr.home}>← Retour à l'accueil</Link> · <Link to={ROUTES.en.home} lang="en">Back to home</Link></p>
    </SimpleLayout>
  );
}
