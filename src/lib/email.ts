import nodemailer from "nodemailer";

/**
 * Create the SMTP transporter from environment variables.
 * If SMTP_HOST is not set, falls back to Ethereal (auto-created test account)
 * and logs the preview URL to the console — useful for local dev without SMTP.
 */
async function createTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Dev fallback: Ethereal test account (emails visible at ethereal.email)
  const testAccount = await nodemailer.createTestAccount();
  console.log("[email] No SMTP_HOST set — using Ethereal test account");
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

const FROM = process.env.SMTP_FROM ?? "noreply@lop-dashboard.local";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function sendVerificationEmail(
  to: string,
  username: string,
  token: string
): Promise<void> {
  const link = `${BASE_URL}/verify-email?token=${token}`;
  const transporter = await createTransporter();

  const info = await transporter.sendMail({
    from: FROM,
    to,
    subject: "Verifikasi Akun Dashboard LOP Prioritas",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e40af">Verifikasi Email Anda</h2>
        <p>Halo <strong>${username}</strong>,</p>
        <p>Terima kasih telah mendaftar di Dashboard LOP Prioritas 20 Branch.</p>
        <p>Klik tombol di bawah untuk mengaktifkan akun Anda:</p>
        <a href="${link}"
           style="display:inline-block;margin:16px 0;padding:12px 24px;
                  background:#2563eb;color:#fff;text-decoration:none;
                  border-radius:8px;font-weight:600">
          Verifikasi Akun
        </a>
        <p style="color:#64748b;font-size:13px">
          Link berlaku selama 24 jam. Jika Anda tidak mendaftar, abaikan email ini.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#94a3b8;font-size:12px">Telkom Indonesia · TREG 3</p>
      </div>
    `,
  });

  // In dev (Ethereal), log the preview URL so the email can be inspected
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[email] Verification email preview: ${previewUrl}`);
  }
}
