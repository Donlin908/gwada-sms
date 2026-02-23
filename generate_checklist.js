import XLSX from 'xlsx';
import path from 'path';

const tasks = [
  { "Tâche": "Passer Stripe en mode Production", "Catégorie": "Paiement", "Priorité": "Haute", "Statut": "À faire" },
  { "Tâche": "Approvisionner des numéros réels (France/USA)", "Catégorie": "Inventaire", "Priorité": "Haute", "Statut": "À faire" },
  { "Tâche": "Vérifier la réception SMS < 30s en réel", "Catégorie": "Performance", "Priorité": "Critique", "Statut": "En cours" },
  { "Tâche": "Créer les pages Mentions Légales / CGU", "Catégorie": "Légal", "Priorité": "Moyenne", "Statut": "À faire" },
  { "Tâche": "Ajouter un formulaire de contact/support", "Catégorie": "UI/UX", "Priorité": "Moyenne", "Statut": "À faire" },
  { "Tâche": "Optimisation SEO pour les DOM (Guadeloupe, Martinique, etc.)", "Catégorie": "Marketing", "Priorité": "Haute", "Statut": "En cours" },
  { "Tâche": "Audit de sécurité final (Sessions, XSS)", "Catégorie": "Sécurité", "Priorité": "Haute", "Statut": "À faire" },
  { "Tâche": "Finaliser le design responsive mobile", "Catégorie": "UI/UX", "Priorité": "Haute", "Statut": "En cours" },
  { "Tâche": "Configurer les notifications par email pour l'admin", "Catégorie": "Backend", "Priorité": "Moyenne", "Statut": "Complété" },
  { "Tâche": "Vérifier l'auto-achat de numéros si stock bas", "Catégorie": "Backend", "Priorité": "Haute", "Statut": "Complété" }
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(tasks);

// Ajuster la largeur des colonnes
const wscols = [
  { wch: 60 }, // Tâche
  { wch: 15 }, // Catégorie
  { wch: 10 }, // Priorité
  { wch: 12 }  // Statut
];
ws['!cols'] = wscols;

XLSX.utils.book_append_sheet(wb, ws, "Checklist Projet");

const filePath = path.join(process.cwd(), 'checklist_projet.xlsx');
XLSX.writeFile(wb, filePath);

console.log(`Checklist générée avec succès : ${filePath}`);
