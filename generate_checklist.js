import XLSX from 'xlsx';
import path from 'path';

const tasks = [
  { "Tâche": "Passer Stripe en mode Production", "Catégorie": "Paiement", "Priorité": "Haute", "Statut": "Complété", "Notes": "Testé avec vraies cartes ET cartes de test (voir Stripe dashboard)" },
  { "Tâche": "Sécuriser le webhook Stripe (signature)", "Catégorie": "Paiement", "Priorité": "Haute", "Statut": "Complété", "Notes": "STRIPE_WEBHOOK_SECRET configuré, requêtes non signées rejetées" },
  { "Tâche": "Page d'échec paiement (carte refusée)", "Catégorie": "Paiement", "Priorité": "Moyenne", "Statut": "Complété", "Notes": "Testé avec carte fictive refusée — message + bouton retry OK" },
  { "Tâche": "Vérifier la réception SMS < 30s en réel", "Catégorie": "Performance", "Priorité": "Critique", "Statut": "Complété", "Notes": "Testé depuis téléphone perso, SMS bien reçus" },
  { "Tâche": "Vérifier réception code WhatsApp / autres services tiers", "Catégorie": "Performance", "Priorité": "Critique", "Statut": "En cours", "Notes": "À tester : WhatsApp, Google, Instagram, Telegram, etc. — certains services bloquent les numéros VoIP" },
  { "Tâche": "Approvisionner des numéros réels (France/USA)", "Catégorie": "Inventaire", "Priorité": "Haute", "Statut": "À faire", "Notes": "" },
  { "Tâche": "Créer les pages Mentions Légales / CGU", "Catégorie": "Légal", "Priorité": "Moyenne", "Statut": "Complété", "Notes": "/mentions-legales et /cgu en ligne" },
  { "Tâche": "Ajouter un formulaire de contact/support", "Catégorie": "UI/UX", "Priorité": "Moyenne", "Statut": "Complété", "Notes": "/contact en ligne avec FAQ" },
  { "Tâche": "Optimisation SEO pour les DOM (Guadeloupe, Martinique, etc.)", "Catégorie": "Marketing", "Priorité": "Haute", "Statut": "En cours", "Notes": "" },
  { "Tâche": "Audit de sécurité final (Sessions, XSS, CSRF, headers)", "Catégorie": "Sécurité", "Priorité": "Haute", "Statut": "À faire", "Notes": "Voir onglet 'Audit Sécurité' pour le détail des vérifications" },
  { "Tâche": "Finaliser le design responsive mobile", "Catégorie": "UI/UX", "Priorité": "Haute", "Statut": "En cours", "Notes": "Modale Telegram et bouton corrigés récemment" },
  { "Tâche": "Configurer les notifications par email pour l'admin", "Catégorie": "Backend", "Priorité": "Moyenne", "Statut": "Complété", "Notes": "" },
  { "Tâche": "Vérifier l'auto-achat de numéros si stock bas", "Catégorie": "Backend", "Priorité": "Haute", "Statut": "Complété", "Notes": "" },
];

const securityAudit = [
  { "Catégorie": "Sessions", "Vérification": "Cookies de session en HttpOnly + Secure + SameSite", "Priorité": "Haute", "Statut": "À vérifier" },
  { "Catégorie": "Sessions", "Vérification": "Session régénérée à la connexion (anti session fixation)", "Priorité": "Haute", "Statut": "Fait (login régénère la session)" },
  { "Catégorie": "Sessions", "Vérification": "Expiration de session configurée (pas de session infinie)", "Priorité": "Moyenne", "Statut": "À vérifier" },
  { "Catégorie": "Sessions", "Vérification": "Stockage des sessions en base (pas en mémoire) — connect-pg-simple", "Priorité": "Moyenne", "Statut": "Fait" },
  { "Catégorie": "Authentification", "Vérification": "Mots de passe hashés (bcrypt) — jamais en clair", "Priorité": "Critique", "Statut": "Fait" },
  { "Catégorie": "Authentification", "Vérification": "Rate limiting sur /login et /admin/login (anti brute-force)", "Priorité": "Haute", "Statut": "Fait" },
  { "Catégorie": "Authentification", "Vérification": "Vérification email obligatoire avant usage complet du compte", "Priorité": "Moyenne", "Statut": "Fait" },
  { "Catégorie": "Authentification", "Vérification": "Accès admin protégé indépendamment des comptes utilisateurs normaux", "Priorité": "Critique", "Statut": "Fait (session.adminAuth séparée)" },
  { "Catégorie": "XSS", "Vérification": "Aucune donnée utilisateur injectée sans échappement dans le HTML (React échappe par défaut)", "Priorité": "Haute", "Statut": "À vérifier (chercher tout usage de dangerouslySetInnerHTML)" },
  { "Catégorie": "XSS", "Vérification": "Contenu des SMS reçus affiché en texte brut, jamais interprété comme HTML", "Priorité": "Haute", "Statut": "À vérifier" },
  { "Catégorie": "CSRF", "Vérification": "Protection CSRF sur les routes sensibles (paiement, admin, changement de mot de passe)", "Priorité": "Haute", "Statut": "À faire — aucune protection CSRF explicite actuellement" },
  { "Catégorie": "Headers HTTP", "Vérification": "Headers de sécurité (Helmet) : CSP, X-Frame-Options, X-Content-Type-Options, HSTS", "Priorité": "Haute", "Statut": "À faire — non installé" },
  { "Catégorie": "Injection", "Vérification": "Toutes les requêtes SQL passent par Drizzle ORM (requêtes paramétrées, pas de concaténation)", "Priorité": "Critique", "Statut": "Fait" },
  { "Catégorie": "Validation", "Vérification": "Toutes les entrées API validées avec des schémas Zod avant traitement", "Priorité": "Haute", "Statut": "À vérifier route par route" },
  { "Catégorie": "Secrets", "Vérification": "Aucune clé API / secret en dur dans le code (tout en variables d'environnement)", "Priorité": "Critique", "Statut": "Fait" },
  { "Catégorie": "Secrets", "Vérification": "Webhook Stripe vérifie la signature (STRIPE_WEBHOOK_SECRET)", "Priorité": "Critique", "Statut": "Fait" },
  { "Catégorie": "Autorisation", "Vérification": "Un utilisateur ne peut voir que ses propres réservations/messages (pas d'accès par ID d'un autre user)", "Priorité": "Critique", "Statut": "Fait (filtré par session/sessionId invité)" },
  { "Catégorie": "Autorisation", "Vérification": "Un client ne voit jamais les SMS d'un précédent locataire du même numéro", "Priorité": "Critique", "Statut": "Fait (filtré par reservation.startsAt)" },
  { "Catégorie": "Dépendances", "Vérification": "Audit des dépendances npm pour vulnérabilités connues (npm audit)", "Priorité": "Moyenne", "Statut": "À faire" },
  { "Catégorie": "Transport", "Vérification": "HTTPS forcé sur tout le trafic (pas de fallback HTTP)", "Priorité": "Haute", "Statut": "À vérifier (géré par Replit Deployments normalement)" },
  { "Catégorie": "Logs", "Vérification": "Aucune donnée sensible (mot de passe, token, carte) dans les logs serveur", "Priorité": "Haute", "Statut": "À vérifier" },
  { "Catégorie": "Rate limiting", "Vérification": "Rate limiting sur les routes de paiement (anti-spam de checkout)", "Priorité": "Moyenne", "Statut": "Fait" },
];

const wb = XLSX.utils.book_new();

const ws1 = XLSX.utils.json_to_sheet(tasks);
ws1['!cols'] = [{ wch: 55 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 60 }];
XLSX.utils.book_append_sheet(wb, ws1, "Checklist Projet");

const ws2 = XLSX.utils.json_to_sheet(securityAudit);
ws2['!cols'] = [{ wch: 16 }, { wch: 70 }, { wch: 10 }, { wch: 45 }];
XLSX.utils.book_append_sheet(wb, ws2, "Audit Sécurité");

const filePath = path.join(process.cwd(), 'checklist_projet.xlsx');
XLSX.writeFile(wb, filePath);

console.log(`Checklist générée avec succès : ${filePath}`);
