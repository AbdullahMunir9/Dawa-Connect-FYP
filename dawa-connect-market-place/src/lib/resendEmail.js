import "server-only";

import { Resend } from "resend";
import { getEmailVerificationConfig } from "@/lib/emailConfig";

let cachedClient;
let cachedKey;

export function getResendClient() {
  const { apiKey } = getEmailVerificationConfig();
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new Resend(apiKey);
    cachedKey = apiKey;
  }
  return cachedClient;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendSignupVerificationEmail({ to, name, otp }) {
  const { from, expiryMinutes } = getEmailVerificationConfig();
  const safeName = escapeHtml(name);
  const safeOtp = escapeHtml(otp);
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: "Verify your DawaConnect email",
    text: `Hello ${name},\n\nYour DawaConnect verification code is ${otp}. It expires in ${expiryMinutes} minutes.\n\nIf you did not request this account, you can ignore this email. DawaConnect will never ask you to share this code.`,
    html: `<!doctype html>
      <html lang="en"><body style="margin:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#172033">
        <div style="max-width:560px;margin:0 auto;padding:32px 16px">
          <div style="overflow:hidden;border:1px solid #dfe7ef;border-radius:20px;background:#fff;box-shadow:0 12px 32px rgba(15,23,42,.08)">
            <div style="padding:24px 28px;background:linear-gradient(135deg,#0f766e,#0f4c81);color:#fff">
              <div style="font-size:22px;font-weight:800">DawaConnect</div>
              <div style="margin-top:4px;font-size:13px;opacity:.85">Healthcare Marketplace</div>
            </div>
            <div style="padding:30px 28px">
              <p style="margin:0 0 14px;font-size:16px">Hello ${safeName},</p>
              <p style="margin:0;color:#526071;line-height:1.6">Enter this code to verify your email and finish creating your marketplace account.</p>
              <div style="margin:26px 0;border-radius:14px;background:#eef7f6;padding:20px;text-align:center;font-size:34px;font-weight:800;letter-spacing:10px;color:#0f766e">${safeOtp}</div>
              <p style="margin:0;color:#526071;line-height:1.6">This code expires in <strong>${expiryMinutes} minutes</strong>. Never share it with anyone.</p>
              <div style="margin-top:24px;border-top:1px solid #e7edf3;padding-top:18px;font-size:12px;line-height:1.6;color:#7a8797">If you did not request this account, no action is needed.</div>
            </div>
          </div>
          <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#8a96a6">Sent securely by DawaConnect · dawaconnect.store</p>
        </div>
      </body></html>`,
    tags: [{ name: "category", value: "marketplace_signup_otp" }],
  });

  if (error || !data?.id) throw new Error(error?.message || "Resend did not accept the verification email.");
  return data.id;
}
