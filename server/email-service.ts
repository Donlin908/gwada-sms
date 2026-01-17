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
      subject: `⚠️ NuméroSMS - Numéro ${data.phoneNumber} a atteint ${data.usageCount} utilisations`,
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
            Cet email a été envoyé automatiquement par NuméroSMS.
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
      subject: `✅ NuméroSMS - Nouveau numéro acheté: ${data.phoneNumber}`,
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
            Cet email a été envoyé automatiquement par NuméroSMS.
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
