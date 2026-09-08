import nodemailer, { type Transporter } from "nodemailer";

/**
 * Gmail delivery via Nodemailer, authenticated with Google OAuth2.
 *
 * OAuth2 is Google's current, recommended mechanism. You supply a long-lived
 * **refresh token**; Nodemailer exchanges it for a short-lived access token
 * automatically before each send and renews it as needed, so nothing here has
 * to be rotated by hand.
 *
 * Required env vars (see .env.example for how to obtain each):
 *   GMAIL_USER            the Gmail address that sends the mail
 *   GOOGLE_CLIENT_ID      OAuth client ID     (Google Cloud Console)
 *   GOOGLE_CLIENT_SECRET  OAuth client secret (Google Cloud Console)
 *   GOOGLE_REFRESH_TOKEN  refresh token       (OAuth Playground)
 *
 * A 16-character App Password (GMAIL_APP_PASSWORD) is still honoured as a
 * fallback when no OAuth2 credentials are present.
 *
 * If nothing is configured the app stays fully usable: mail is logged to the
 * console instead of sent, and login codes surface in the UI (see the route
 * handler). That fallback is disabled the moment real credentials exist.
 */
const GMAIL_USER = process.env.GMAIL_USER?.trim();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN?.trim();
// Optional: only needed if you want to pin a pre-fetched access token.
const ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN?.trim();
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

const oauthConfigured = Boolean(GMAIL_USER && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
const appPasswordConfigured = Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);

export const mailConfigured = oauthConfigured || appPasswordConfigured;
export const mailMode = oauthConfigured
  ? "oauth2"
  : appPasswordConfigured
    ? "app-password"
    : "disabled";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!mailConfigured) return null;

  if (!transporter) {
    transporter = oauthConfigured
      ? nodemailer.createTransport({
          service: "gmail",
          auth: {
            type: "OAuth2",
            user: GMAIL_USER,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            refreshToken: REFRESH_TOKEN,
            // Nodemailer mints one from the refresh token when omitted.
            ...(ACCESS_TOKEN ? { accessToken: ACCESS_TOKEN } : {}),
          },
        })
      : nodemailer.createTransport({
          service: "gmail",
          auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
        });
  }

  return transporter;
}

export interface MailResult {
  sent: boolean;
  error?: string;
}

async function send(to: string, subject: string, html: string, text: string): Promise<MailResult> {
  const tx = getTransporter();

  if (!tx) {
    console.warn(
      `[mailer] Gmail not configured - email to ${to} was not sent.\n` +
        `         Subject: ${subject}\n` +
        `         Set GMAIL_USER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and\n` +
        `         GOOGLE_REFRESH_TOKEN to enable delivery (see .env.example).`
    );
    return { sent: false, error: "Email is not configured on the server." };
  }

  try {
    await tx.sendMail({
      from: `"VoltEdge Charging" <${GMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // A revoked or expired refresh token is the most common OAuth2 failure and
    // the message Google returns ("invalid_grant") is not self-explanatory.
    if (mailMode === "oauth2" && /invalid_grant|Token has been expired|unauthorized_client/i.test(message)) {
      console.error(
        `[mailer] Google rejected the refresh token: ${message}\n` +
          `         Generate a new GOOGLE_REFRESH_TOKEN - tokens are revoked when the\n` +
          `         account password changes, or after ~7 days while the OAuth consent\n` +
          `         screen is still in "Testing" mode.`
      );
      return { sent: false, error: "Google rejected the mail credentials. The refresh token needs renewing." };
    }

    console.error(`[mailer] Failed to send "${subject}" to ${to}:`, message);
    return { sent: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

const BRAND = "#10b981";

function shell(heading: string, body: string): string {
  return `
  <div style="margin:0;padding:32px 16px;background:#0b1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">
      <div style="padding:24px 32px;border-bottom:1px solid #1f2937;">
        <span style="display:inline-block;font-size:20px;font-weight:700;color:#f9fafb;letter-spacing:-0.02em;">
          <span style="color:${BRAND};">&#9889;</span> VoltEdge
        </span>
      </div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#f9fafb;font-weight:650;">${heading}</h1>
        ${body}
      </div>
      <div style="padding:20px 32px;border-top:1px solid #1f2937;">
        <p style="margin:0;font-size:12px;color:#6b7280;">
          VoltEdge EV Charging Network &middot; This is an automated message.
        </p>
      </div>
    </div>
  </div>`;
}

const P = `margin:0 0 16px;font-size:15px;line-height:1.6;color:#9ca3af;`;

export function sendLoginCodeEmail(to: string, code: string, minutes: number) {
  const body = `
    <p style="${P}">Use this code to sign in to your VoltEdge account:</p>
    <div style="margin:24px 0;padding:20px;background:#0b1120;border:1px solid #1f2937;border-radius:12px;text-align:center;">
      <span style="font-size:34px;font-weight:700;letter-spacing:10px;color:${BRAND};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${code}</span>
    </div>
    <p style="${P}">This code expires in ${minutes} minutes. If you didn't request it, you can safely ignore this email.</p>`;

  return send(
    to,
    `${code} is your VoltEdge sign-in code`,
    shell("Your sign-in code", body),
    `Your VoltEdge sign-in code is ${code}. It expires in ${minutes} minutes.`
  );
}

export function sendWelcomeEmail(to: string, name: string) {
  const body = `
    <p style="${P}">Hi ${escapeHtml(name)}, your VoltEdge account is ready.</p>
    <div style="margin:24px 0;padding:20px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:12px;">
      <p style="margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:${BRAND};font-weight:600;">Welcome gift</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:#f9fafb;">10% off your first charge</p>
    </div>
    <p style="${P}">Here's how rewards work as you charge with us:</p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.8;color:#9ca3af;">
      <li>Reach <strong style="color:#f9fafb;">20 charges</strong> to unlock Loyal status &mdash; 5% off every charge, forever.</li>
      <li>Every <strong style="color:#f9fafb;">30 charges</strong> earns you a completely free charge.</li>
    </ul>`;

  return send(
    to,
    "Welcome to VoltEdge - here's 10% off",
    shell("Welcome to VoltEdge", body),
    `Hi ${name}, welcome to VoltEdge. You have 10% off your first charge.`
  );
}

export function sendLoginAlertEmail(to: string, name: string, when: Date, loginCount: number) {
  const stamp = when.toUTCString();
  const body = `
    <p style="${P}">Hi ${escapeHtml(name)}, we're letting you know your VoltEdge account was just signed in to.</p>
    <table style="width:100%;margin:24px 0;border-collapse:collapse;background:#0b1120;border:1px solid #1f2937;border-radius:12px;">
      <tr>
        <td style="padding:14px 18px;font-size:14px;color:#6b7280;border-bottom:1px solid #1f2937;">Time</td>
        <td style="padding:14px 18px;font-size:14px;color:#f9fafb;text-align:right;border-bottom:1px solid #1f2937;">${stamp}</td>
      </tr>
      <tr>
        <td style="padding:14px 18px;font-size:14px;color:#6b7280;">Account</td>
        <td style="padding:14px 18px;font-size:14px;color:#f9fafb;text-align:right;">${escapeHtml(to)}</td>
      </tr>
      <tr>
        <td style="padding:14px 18px;font-size:14px;color:#6b7280;border-top:1px solid #1f2937;">Total sign-ins</td>
        <td style="padding:14px 18px;font-size:14px;color:#f9fafb;text-align:right;border-top:1px solid #1f2937;">${loginCount}</td>
      </tr>
    </table>
    <p style="${P}">If this wasn't you, please secure your email account &mdash; VoltEdge sign-in codes are sent there.</p>`;

  return send(
    to,
    "New sign-in to your VoltEdge account",
    shell("New sign-in detected", body),
    `Hi ${name}, your VoltEdge account was signed in to at ${stamp}.`
  );
}

export function sendChargeReceiptEmail(
  to: string,
  name: string,
  receipt: {
    stationName: string;
    kwh: number;
    grossAmount: number;
    discountPercent: number;
    discountAmount: number;
    discountReason: string;
    netAmount: number;
    chargeNumber: number;
    freeChargeEarned: boolean;
    becameLoyal: boolean;
  }
) {
  const row = (label: string, value: string, accent = false) => `
    <tr>
      <td style="padding:12px 18px;font-size:14px;color:#6b7280;border-bottom:1px solid #1f2937;">${label}</td>
      <td style="padding:12px 18px;font-size:14px;color:${accent ? BRAND : "#f9fafb"};text-align:right;border-bottom:1px solid #1f2937;font-weight:${accent ? 600 : 400};">${value}</td>
    </tr>`;

  const milestones: string[] = [];
  if (receipt.becameLoyal) {
    milestones.push(
      `<div style="margin:0 0 12px;padding:16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:12px;">
         <p style="margin:0;font-size:15px;color:#f9fafb;font-weight:600;">&#127881; You're now a Loyal customer!</p>
         <p style="margin:6px 0 0;font-size:14px;color:#9ca3af;">Enjoy 5% off every charge from here on.</p>
       </div>`
    );
  }
  if (receipt.freeChargeEarned) {
    milestones.push(
      `<div style="margin:0 0 12px;padding:16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:12px;">
         <p style="margin:0;font-size:15px;color:#f9fafb;font-weight:600;">&#127873; You've earned a FREE charge!</p>
         <p style="margin:6px 0 0;font-size:14px;color:#9ca3af;">Redeem it any time from your dashboard.</p>
       </div>`
    );
  }

  const body = `
    <p style="${P}">Hi ${escapeHtml(name)}, here's the receipt for charge #${receipt.chargeNumber}.</p>
    ${milestones.join("")}
    <table style="width:100%;margin:24px 0;border-collapse:collapse;background:#0b1120;border:1px solid #1f2937;border-radius:12px;">
      ${row("Station", escapeHtml(receipt.stationName))}
      ${row("Energy delivered", `${receipt.kwh.toFixed(2)} kWh`)}
      ${row("Subtotal", `PKR ${receipt.grossAmount.toFixed(2)}`)}
      ${receipt.discountAmount > 0 ? row(escapeHtml(receipt.discountReason), `− PKR ${receipt.discountAmount.toFixed(2)}`, true) : ""}
      <tr>
        <td style="padding:16px 18px;font-size:16px;color:#f9fafb;font-weight:600;">Total paid</td>
        <td style="padding:16px 18px;font-size:20px;color:#f9fafb;text-align:right;font-weight:700;">PKR ${receipt.netAmount.toFixed(2)}</td>
      </tr>
    </table>`;

  return send(
    to,
    `Receipt - charge #${receipt.chargeNumber} at ${receipt.stationName}`,
    shell("Charge complete", body),
    `Charge #${receipt.chargeNumber} at ${receipt.stationName}: ${receipt.kwh.toFixed(2)} kWh, paid PKR ${receipt.netAmount.toFixed(2)}.`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
