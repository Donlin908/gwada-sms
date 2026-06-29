import nodemailer from "nodemailer";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

let transporter: nodemailer.Transporter | null = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

export function isEmailConfigured(): boolean {
  return transporter !== null && ADMIN_EMAIL !== "";
}

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  if (!transporter) {
    console.log("Email not configured. Verification token for", email, ":", token);
    return false;
  }

  const baseUrl = (process.env.PUBLIC_URL || "https://gwadasms.com").replace(/\/+$/, "");
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

  try {
    await transporter.sendMail({
      from: `"GWADA SMS" <${SMTP_USER}>`,
      to: email,
      subject: "Vérifiez votre adresse email - GWADA SMS",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">GWADA SMS</h1>
            <p style="color: #6b7280; margin-top: 5px;">Service de numéros virtuels</p>
          </div>
          
          <h2 style="color: #1f2937;">Confirmez votre adresse email</h2>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Merci de vous être inscrit sur GWADA SMS ! Pour activer votre compte, 
            veuillez cliquer sur le bouton ci-dessous :
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" 
               style="background-color: #2563eb; color: white; padding: 14px 32px; 
                      text-decoration: none; border-radius: 8px; font-size: 16px; 
                      font-weight: bold; display: inline-block;">
              Vérifier mon email
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Ce lien est valable pendant 24 heures. Si vous n'avez pas créé de compte, 
            vous pouvez ignorer cet email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            GWADA SMS - Service de numéros virtuels pour les DOM
          </p>
        </div>
      `,
    });

    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return false;
  }
}

export interface UsageAlertData {
  phoneNumber: string;
  country: string;
  usageCount: number;
  threshold: number;
}

export async function sendUsageAlert(data: UsageAlertData): Promise<boolean> {
  if (!transporter || !ADMIN_EMAIL) {
    console.log("Email not configured. Alert data:", data);
    return false;
  }

  const countryName = data.country === "france" ? "France" : "USA";
  
  try {
    await transporter.sendMail({
      from: SMTP_USER,
      to: ADMIN_EMAIL,
      subject: `⚠️ GWADA SMS - Numéro ${data.phoneNumber} a atteint ${data.usageCount} utilisations`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ef4444;">Alerte d'utilisation de numéro</h1>
          
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 16px;">
              Le numéro <strong>${data.phoneNumber}</strong> (${countryName}) a atteint 
              <strong>${data.usageCount} utilisations</strong>.
            </p>
          </div>
          
          <p>Le seuil d'alerte est configuré à <strong>${data.threshold} utilisations</strong>.</p>
          
          <h2 style="color: #374151;">Actions recommandées :</h2>
          <ul>
            <li>Vérifier si le numéro est toujours fonctionnel</li>
            <li>Envisager d'acheter un nouveau numéro pour ce pays</li>
            <li>Retirer le numéro de la rotation si nécessaire</li>
          </ul>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Cet email a été envoyé automatiquement par GWADA SMS.
          </p>
        </div>
      `,
    });
    
    console.log(`Alert email sent for ${data.phoneNumber}`);
    return true;
  } catch (error) {
    console.error("Failed to send alert email:", error);
    return false;
  }
}

export interface TicketResponseData {
  ticketId: number;
  category: string;
  originalMessage: string;
  adminResponse: string;
  userName?: string | null;
}

export async function sendTicketResponseEmail(toEmail: string, data: TicketResponseData): Promise<boolean> {
  if (!transporter) {
    console.log("Email not configured. Ticket response not sent for ticket", data.ticketId);
    return false;
  }

  const CATEGORY_LABELS: Record<string, string> = {
    sms_not_received: "SMS non reçu",
    telegram: "Problème Telegram",
    payment: "Problème de paiement",
    wrong_number: "Numéro incorrect",
    other: "Autre",
  };

  const categoryLabel = CATEGORY_LABELS[data.category] ?? data.category;
  const greeting = data.userName ? `Bonjour ${data.userName},` : "Bonjour,";
  const baseUrl = (process.env.PUBLIC_URL || "https://gwadasms.com").replace(/\/+$/, "");

  try {
    await transporter.sendMail({
      from: `"GWADA SMS Support" <${SMTP_USER}>`,
      to: toEmail,
      subject: `[GWADA SMS] Réponse à votre ticket #${data.ticketId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #16a34a; margin: 0; font-size: 24px;">GWADA SMS</h1>
            <p style="color: #6b7280; margin-top: 4px; font-size: 14px;">Service de numéros virtuels</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 8px;">${greeting}</p>
          <p style="font-size: 15px; color: #374151; margin-bottom: 24px;">
            Notre équipe support a répondu à votre ticket <strong>#${data.ticketId}</strong>
            (catégorie : <em>${categoryLabel}</em>).
          </p>

          <div style="background: #f9fafb; border-left: 4px solid #6b7280; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Votre message</p>
            <p style="margin: 0; color: #374151; font-size: 14px; white-space: pre-wrap;">${data.originalMessage}</p>
          </div>

          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px 18px; border-radius: 4px; margin-bottom: 28px;">
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #16a34a; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold;">Réponse du support</p>
            <p style="margin: 0; color: #1f2937; font-size: 15px; white-space: pre-wrap;">${data.adminResponse}</p>
          </div>

          <p style="font-size: 14px; color: #6b7280;">
            Si vous avez d'autres questions, n'hésitez pas à nous contacter depuis
            <a href="${baseUrl}/contact" style="color: #16a34a;">notre page support</a>.
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            GWADA SMS — Service de numéros virtuels pour les DOM-TOM
          </p>
        </div>
      `,
    });

    console.log(`Ticket response email sent to ${toEmail} for ticket #${data.ticketId}`);
    return true;
  } catch (error) {
    console.error("Failed to send ticket response email:", error);
    return false;
  }
}

export interface NewNumberPurchasedData {
  phoneNumber: string;
  country: string;
  reason: string;
}

export async function sendNewNumberNotification(data: NewNumberPurchasedData): Promise<boolean> {
  if (!transporter || !ADMIN_EMAIL) {
    console.log("Email not configured. New number data:", data);
    return false;
  }

  const countryName = data.country === "france" ? "France" : "USA";
  
  try {
    await transporter.sendMail({
      from: SMTP_USER,
      to: ADMIN_EMAIL,
      subject: `✅ GWADA SMS - Nouveau numéro acheté: ${data.phoneNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #22c55e;">Nouveau numéro acheté automatiquement</h1>
          
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 16px;">
              Un nouveau numéro a été acheté : <strong>${data.phoneNumber}</strong> (${countryName})
            </p>
          </div>
          
          <p><strong>Raison :</strong> ${data.reason}</p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Cet email a été envoyé automatiquement par GWADA SMS.
          </p>
        </div>
      `,
    });
    
    console.log(`New number notification sent for ${data.phoneNumber}`);
    return true;
  } catch (error) {
    console.error("Failed to send new number notification:", error);
    return false;
  }
}
