/** Langue de la page (fixée par <html lang>) et textes générés par JavaScript. */
export const lang = document.documentElement.lang === "en" ? "en" : "fr";

const STRINGS = {
  fr: {
    cvMissing: "CV bientôt disponible", openNewTab: "nouvel onglet", loadError: "Le contenu n'a pas pu être chargé.",
    about: { vision: "vision", interests: "centres d'intérêt", approach: "méthode", ambitions: "ambitions", available: "Disponible pour de nouveaux projets", unavailable: "Actuellement en poste" },
    levels: { notions: "notions", intermediate: "intermédiaire", advanced: "avancé", expert: "expert" },
    noSkills: "Les compétences seront bientôt présentées ici.",
    career: {
      all: "Tout", today: "en cours", present: "aujourd'hui", tech: "Technologies et outils",
      showMissions: "voir les missions", hideMissions: "masquer les missions",
      degree: "Diplôme obtenu", expires: "expire le", verify: "Vérifier la certification", more: "En savoir plus",
      empty: "Le parcours sera bientôt présenté ici.",
      groups: { work: "Expériences", internship: "Stages", education: "Formations", certification: "Certifications", achievement: "Réalisations" },
      kinds: { job: "Expérience professionnelle", internship: "Stage", apprenticeship: "Alternance", freelance: "Freelance" },
    },
    form: {
      required: "Ce champ est obligatoire.", email: "Saisissez une adresse e-mail valide.",
      min: (n) => `${n} caractères minimum.`, max: (n) => `${n} caractères maximum.`,
      consent: "Votre accord est nécessaire pour envoyer le message.", invalid: "Certains champs sont à corriger.",
      throttled: "Trop d'envois en peu de temps. Merci de réessayer plus tard.",
      network: "Le message n'a pas pu partir (problème de connexion). Réessayez dans un instant.",
      server: "Une erreur est survenue. Réessayez plus tard ou écrivez-moi directement par e-mail.",
      successTitle: (name) => (name ? `Merci, ${name}.` : "Merci."),
      successText: "Votre message est bien arrivé. Je vous réponds dès que possible, en général sous 48 heures.",
      successPreview: "Aperçu : l'envoi est simulé et aucune donnée n'a quitté votre navigateur. Une fois Django branché, le message sera enregistré et vous recevrez une notification.",
      command: "./envoyer-message", again: "Envoyer un autre message", copy: "copier", copied: "copié", selected: "sélectionné", open: "ouvrir",
    },
    case: {
      back: "Tous les projets", projectsAnchor: "projets", breadcrumb: "Fil d'Ariane", toc: "Sommaire",
      viewDemo: "Voir la démo", viewCode: "Code sur GitHub", liveDemo: "Démonstration en ligne", repo: "Dépôt GitHub",
      difficulty: "difficulté", solution: "solution", enlarge: "Agrandir la capture", imageOf: (i, n) => `${i} / ${n}`,
      previous: "Projet précédent", next: "Projet suivant", otherProjects: "Autres projets",
      notFound: "Projet introuvable", notFoundText: "Ce projet n'existe pas ou n'est plus publié.",
      chapters: { context: "Contexte", problem: "Problématique", objectives: "Objectifs", features: "Fonctionnalités", architecture: "Architecture technique", technologies: "Technologies", screenshots: "Captures d'écran", challenges: "Difficultés et solutions", results: "Résultats", links: "Liens" },
    },
    projects: {
      all: "Tous", allTech: "Toutes les technologies", details: "Voir le projet", demo: "Démo", stack: "Technologies",
      sample: "Exemple", sampleNotice: "Projet d'exemple : il ne s'agit pas d'une réalisation réelle.", featured: "À la une",
      shotMissing: "capture à remplacer", reset: "Réinitialiser les filtres", none: "Aucun projet publié pour le moment.",
      noMatch: "Aucun projet ne correspond à ces filtres.",
      count: (n) => (n > 1 ? `${n} projets` : `${n} projet`),
    },
  },
  en: {
    cvMissing: "Résumé coming soon", openNewTab: "new tab", loadError: "The content could not be loaded.",
    about: { vision: "vision", interests: "interests", approach: "approach", ambitions: "ambitions", available: "Open to new projects", unavailable: "Currently employed" },
    levels: { notions: "basics", intermediate: "intermediate", advanced: "advanced", expert: "expert" },
    noSkills: "Skills will be listed here soon.",
    career: {
      all: "All", today: "current", present: "present", tech: "Technologies and tools",
      showMissions: "show assignments", hideMissions: "hide assignments",
      degree: "Degree awarded", expires: "expires", verify: "Verify the certification", more: "Learn more",
      empty: "Background will be listed here soon.",
      groups: { work: "Experience", internship: "Internships", education: "Education", certification: "Certifications", achievement: "Achievements" },
      kinds: { job: "Professional experience", internship: "Internship", apprenticeship: "Apprenticeship", freelance: "Freelance" },
    },
    form: {
      required: "This field is required.", email: "Please enter a valid email address.",
      min: (n) => `At least ${n} characters.`, max: (n) => `At most ${n} characters.`,
      consent: "Your consent is required to send the message.", invalid: "Some fields need your attention.",
      throttled: "Too many messages in a short time. Please try again later.",
      network: "The message could not be sent (connection issue). Please try again in a moment.",
      server: "Something went wrong. Please try again later or email me directly.",
      successTitle: (name) => (name ? `Thank you, ${name}.` : "Thank you."),
      successText: "Your message has arrived. I will get back to you as soon as possible, usually within 48 hours.",
      successPreview: "Preview: sending is simulated and no data left your browser. Once Django is connected, the message will be stored and a notification sent.",
      command: "./send-message", again: "Send another message", copy: "copy", copied: "copied", selected: "selected", open: "open",
    },
    case: {
      back: "All projects", projectsAnchor: "projects", breadcrumb: "Breadcrumb", toc: "Contents",
      viewDemo: "View live demo", viewCode: "Code on GitHub", liveDemo: "Live demo", repo: "GitHub repository",
      difficulty: "challenge", solution: "solution", enlarge: "Enlarge screenshot", imageOf: (i, n) => `${i} / ${n}`,
      previous: "Previous project", next: "Next project", otherProjects: "Other projects",
      notFound: "Project not found", notFoundText: "This project does not exist or is no longer published.",
      chapters: { context: "Context", problem: "Problem", objectives: "Objectives", features: "Features", architecture: "Technical architecture", technologies: "Technologies", screenshots: "Screenshots", challenges: "Challenges and solutions", results: "Results", links: "Links" },
    },
    projects: {
      all: "All", allTech: "All technologies", details: "View project", demo: "Live demo", stack: "Technologies",
      sample: "Sample", sampleNotice: "Sample project: this is not a real piece of work.", featured: "Featured",
      shotMissing: "screenshot to replace", reset: "Reset filters", none: "No published project yet.",
      noMatch: "No project matches these filters.",
      count: (n) => (n === 1 ? "1 project" : `${n} projects`),
    },
  },
};

export const t = STRINGS[lang];

const locale = lang === "en" ? "en-GB" : "fr-FR";
const monthYear = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
const yearOnly = new Intl.DateTimeFormat(locale, { year: "numeric" });

/** Dates au format AAAA-MM-JJ venant de l'API, affichées selon la langue de la page. */
export function formatDate(value, { year = false } = {}) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : (year ? yearOnly : monthYear).format(date);
}

export function formatRange(start, end, options) {
  const from = formatDate(start, options);
  const to = end ? formatDate(end, options) : STRINGS[lang].career.present;
  return from ? `${from} — ${to}` : to;
}
