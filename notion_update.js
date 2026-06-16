const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const pageId = '3659887dab68814f90cde8de154e104c';

function td(text, checked = false) {
  return { type: 'to_do', to_do: { checked, rich_text: [{ type: 'text', text: { content: text } }] } };
}
function h1(text) {
  return { type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: text } }] } };
}
function h2(text) {
  return { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: text } }] } };
}
function p(text) {
  return { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: text } }] } };
}
const divider = { type: 'divider', divider: {} };

async function run() {
  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      divider,
      h1('BILAN SEANCE — 15/06/2026'),
      h2('Accompli aujourd\'hui'),
      td('Paiements Stripe live operationnels — plan 24h (2€) et 30j (9€) testes avec vraie carte, reservation creee, bot Telegram notifie', true),
      td('Numéros Canada visibles sur le site — bug country=usa corrige via migration auto au demarrage serveur (+1-289, +1-343, +1-825)', true),
      td('Redirection paiement Canada fonctionnelle pour tous les plans (24h / 7j / 30j)', true),
      td('Alerte 48h bot Telegram corrigee — verification via DB (plus de confusion cles test/live Stripe)', true),
      td('Bouton Telegram sur page Messages corrige — fallback /api/numbers/:id/active-reservation sans auth', true),
      td('Drapeau Canada affiché correctement sur la page Messages', true),
      divider,
      h1('A FAIRE DEMAIN — 16/06/2026'),
      h2('1. Tests paiements (mode fictif + reel)'),
      td('Tester plan 7j (5€) avec vraie carte — price ID live : price_1TiiAuCi3VTHILCdPw3P8Ktz'),
      td('Tester les 3 plans en mode fictif (carte test 4242 4242 4242 4242) sur apercu dev'),
      td('Tester paiement refuse (carte 4000 0000 0000 0002) — verifier page erreur correcte'),
      td('Tester flux complet Canada : paiement → numero reserve → recevoir un SMS → verifier dans Messages'),
      td('Verifier que le webhook Stripe recoit et traite bien checkout.session.completed'),
      h2('2. Email de confirmation apres paiement'),
      p('ATTENTION : aucun email envoye au client lors d\'un paiement. A implementer.'),
      td('Option A (recommandee) : activer Email receipts dans Stripe Dashboard → Settings → Customer emails'),
      td('Option B : implémenter sendPaymentConfirmationEmail() dans server/email-service.ts — declenche dans confirm-payment route'),
      td('Configurer variables SMTP si option B : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS'),
      td('Verifier qu\'un email de confirmation arrive dans la boite du client apres un paiement test'),
      h2('3. Facture electronique (format legal SASU)'),
      p('Obligatoire pour une SASU — chaque transaction doit avoir une facture numerotee avec TVA.'),
      td('Option A (recommandee) : activer Stripe Invoicing — Stripe genere et envoie des factures PDF conformes avec numero, TVA, SIREN'),
      td('Dans Stripe Dashboard → Settings → Customer emails → cocher Successful payments + footer SIREN/TVA'),
      td('Option B : generer un PDF cote serveur (pdfkit) avec numero de facture, date, montant, TVA, SIREN — appele depuis webhook Stripe'),
      td('Tester qu\'une facture PDF est recue par email apres un paiement'),
      h2('4. Test fonctionnement global du site'),
      td('Parcours client complet : Accueil → Numeros → Choisir Canada → Payer → Messages → Recevoir SMS'),
      td('Verifier page Tarifs — prix affiches correspondent aux plans Stripe live (2€, 5€, 9€)'),
      td('Verifier page Mon Espace — liste des reservations actives visible et correcte'),
      td('Tester sur mobile (responsive) — navigation, paiement, lecture SMS'),
      td('Verifier que le bot Telegram recoit : notification paiement, alerte 48h avant expiration, SMS recus'),
      td('Tester expiration d\'un numero — le numero redevient disponible apres expiration de la reservation'),
      td('Verifier dashboard Admin — stats numeros, synchronisation Twilio, alertes'),
      divider,
      {
        type: 'callout',
        callout: {
          rich_text: [{ type: 'text', text: { content: 'PRIORITE ABSOLUE avant ouverture au public : Email de confirmation + Facture electronique. Sans ces 2 elements, la conformite legale SASU n\'est pas assuree.' } }],
          icon: { type: 'emoji', emoji: '⚠️' },
          color: 'yellow_background'
        }
      }
    ]
  });
  console.log('Notion mis a jour avec succes');
}
run().catch(e => console.error(e.message));
