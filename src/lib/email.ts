import nodemailer from "nodemailer10";

async function createTransporter() {
  if (process.env.SMTP_HOST) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error("SMTP_USER and SMTP_PASS are required when SMTP_HOST is set");
    }
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

  if (process.env.NODE_ENV === "production") {
    throw new Error("SMTP_HOST is required in production");
  }

  const testAccount = await nodemailer.createTestAccount();
  console.info("[email] No SMTP_HOST set; using an Ethereal test account");
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character
  );
}

export async function sendVerificationEmail(
  to: string,
  username: string,
  token: string
): Promise<void> {
  const from = process.env.SMTP_FROM ?? "noreply@lop-dashboard.local";
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const transporter = await createTransporter();
  const safeUsername = escapeHtml(username);
  const safeLink = escapeHtml(link);

  const info = await transporter.sendMail({
    from,
    to,
    subject: "Verifikasi Akun Dashboard LOP Prioritas",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e40af">Verifikasi Email Anda</h2>
        <p>Halo <strong>${safeUsername}</strong>,</p>
        <p>Terima kasih telah mendaftar di Dashboard LOP Priority 20 Branch.</p>
        <p>Klik tombol di bawah untuk mengaktifkan akun Anda:</p>
        <a href="${safeLink}"
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

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.info(`[email] Verification email preview: ${previewUrl}`);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  username: string,
  token: string
): Promise<void> {
  const from = process.env.SMTP_FROM ?? "noreply@lop-dashboard.local";
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const transporter = await createTransporter();
  const safeUsername = escapeHtml(username);
  const safeLink = escapeHtml(link);
  await transporter.sendMail({
    from,
    to,
    subject: "Reset Password Dashboard LOP Prioritas",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1e40af">Reset Password</h2>
        <p>Halo <strong>${safeUsername}</strong>,</p>
        <p>Klik tombol di bawah untuk membuat password baru:</p>
        <a href="${safeLink}"
           style="display:inline-block;margin:16px 0;padding:12px 24px;
                  background:#2563eb;color:#fff;text-decoration:none;
                  border-radius:8px;font-weight:600">
          Reset Password
        </a>
        <p style="color:#64748b;font-size:13px">
          Link berlaku selama satu jam. Jika Anda tidak meminta reset password, abaikan email ini.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#94a3b8;font-size:12px">Telkom Indonesia · TREG 3</p>
      </div>
    `,
  });
}
