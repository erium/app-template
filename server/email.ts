import nodemailer from 'nodemailer';
import { APP_NAME } from '@shared/config';

// Email configuration
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.example.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || `${APP_NAME} <noreply@example.com>`;

// App URL - must be set via environment variable for production
// Falls back to localhost for development only
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter && SMTP_USER && SMTP_PASS) {
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
  return transporter;
}

// Translations
const translations = {
  de: {
    verifySubject: 'E-Mail bestätigen',
    greeting: 'Hallo',
    welcome: 'Willkommen!',
    message: 'Vielen Dank für deine Registrierung. Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren:',
    button: 'E-Mail bestätigen',
    info: 'Dieser Link ist 24 Stunden gültig.',
    fallback: 'Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:',
    ignore: 'Falls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.',
    footer: '',
    inviteSubject: 'Einladung',
    inviteMessage: 'Du wurdest eingeladen beizutreten. Klicke auf den folgenden Link, um die Einladung anzunehmen:',
    inviteButton: 'Einladung annehmen',
    resetSubject: 'Passwort zurücksetzen',
    resetMessage: 'Du hast angefordert, dein Passwort zurückzusetzen. Klicke auf den folgenden Link:',
    resetButton: 'Passwort zurücksetzen'
  },
  en: {
    verifySubject: 'Verify Email',
    greeting: 'Hello',
    welcome: 'Welcome!',
    message: 'Thank you for registering. Please confirm your email address to activate your account:',
    button: 'Verify Email',
    info: 'This link is valid for 24 hours.',
    fallback: 'If the button does not work, copy this link into your browser:',
    ignore: 'If you did not register, you can simply ignore this email.',
    footer: '',
    inviteSubject: 'Invitation',
    inviteMessage: 'You have been invited to join. Click the link below to accept the invitation:',
    inviteButton: 'Accept Invitation',
    resetSubject: 'Reset Password',
    resetMessage: 'You requested to reset your password. Click the link below:',
    resetButton: 'Reset Password'
  }
};

function getEmailTemplate(content: string, lang: 'de' | 'en' = 'de'): string {
  const t = translations[lang];
  return `
    <!DOCTYPE html>
    <html lang="${lang}">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: #18181b; padding: 32px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 40px 32px; color: #3f3f46; line-height: 1.6; }
        .button { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 24px 0; }
        .footer { background: #f4f4f5; padding: 24px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #e4e4e7; }
        .link-text { font-family: monospace; background: #f4f4f5; padding: 8px; border-radius: 4px; word-break: break-all; font-size: 12px; color: #2563eb; display: block; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${APP_NAME}</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}</p>
          <p>${t.footer}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendVerificationEmail(email: string, token: string, name?: string, lang: 'de' | 'en' = 'de'): Promise<boolean> {
  const transport = getTransporter();
  const t = translations[lang];
  const verifyLink = `${APP_URL}/verify?token=${token}`;
  
  // Log for dev/debugging even if no transport
  console.log(`[Email] Verification for ${email} (${lang}): ${verifyLink}`);

  if (!transport) {
    return true; // Simulate success in dev
  }

  const greeting = name ? `${t.greeting} ${name}` : t.greeting;

  const content = `
    <h2 style="margin-top: 0; color: #18181b;">${t.welcome}</h2>
    <p>${greeting},</p>
    <p>${t.message}</p>
    
    <div style="text-align: center;">
      <a href="${verifyLink}" class="button" style="color: #ffffff !important;">${t.button}</a>
    </div>
    
    <p style="font-size: 14px; color: #71717a;">ℹ️ ${t.info}</p>
    
    <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 32px 0;">
    
    <p style="font-size: 13px; margin-bottom: 4px;">${t.fallback}</p>
    <a href="${verifyLink}" class="link-text">${verifyLink}</a>
    
    <p style="font-size: 13px; margin-top: 24px; color: #a1a1aa;">${t.ignore}</p>
  `;

  try {
    await transport.sendMail({
      from: SMTP_FROM,
      to: email,
      subject: t.verifySubject,
      html: getEmailTemplate(content, lang),
      text: `${t.welcome}

${t.message}
${verifyLink}`
    });
    console.log(`[Email] Verification sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send verification:', error);
    return false;
  }
}


export async function sendInvitationEmail(email: string, token: string, inviterName?: string, lang: 'de' | 'en' = 'de'): Promise<boolean> {
  const transport = getTransporter();
  // Cast to any to avoid TS errors if types aren't perfect for the new keys yet
  const t = translations[lang] as any; 
  const inviteLink = `${APP_URL}/join?token=${token}`;
  
  console.log(`[Email] Invitation for ${email} (${lang}): ${inviteLink}`);

  if (!transport) {
    return true; 
  }

  const content = `
    <h2 style="margin-top: 0; color: #18181b;">${t.welcome || 'Welcome'}</h2>
    <p>${t.greeting},</p>
    <p>${t.inviteMessage}</p>
    
    <div style="text-align: center;">
      <a href="${inviteLink}" class="button" style="color: #ffffff !important;">${t.inviteButton}</a>
    </div>
    
    <p style="font-size: 14px; color: #71717a;">ℹ️ ${t.info}</p>
    
    <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 32px 0;">
    
    <p style="font-size: 13px; margin-bottom: 4px;">${t.fallback}</p>
    <a href="${inviteLink}" class="link-text">${inviteLink}</a>
  `;

  try {
    await transport.sendMail({
      from: SMTP_FROM,
      to: email,
      subject: t.inviteSubject,
      html: getEmailTemplate(content, lang),
      text: `${t.welcome}\n\n${t.inviteMessage}\n${inviteLink}`
    });
    console.log(`[Email] Invitation sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send invitation:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(email: string, token: string, lang: 'de' | 'en' = 'de'): Promise<boolean> {
  const transport = getTransporter();
  const t = translations[lang] as any;
  const resetLink = `${APP_URL}/reset-password?token=${token}`;
  
  console.log(`[Email] Password Reset for ${email} (${lang}): ${resetLink}`);

  if (!transport) {
    return true; 
  }

  const content = `
    <h2 style="margin-top: 0; color: #18181b;">${t.resetSubject}</h2>
    <p>${t.greeting},</p>
    <p>${t.resetMessage}</p>
    
    <div style="text-align: center;">
      <a href="${resetLink}" class="button" style="color: #ffffff !important;">${t.resetButton}</a>
    </div>
    
    <p style="font-size: 14px; color: #71717a;">ℹ️ ${t.info}</p>
    
    <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 32px 0;">
    
    <p style="font-size: 13px; margin-bottom: 4px;">${t.fallback}</p>
    <a href="${resetLink}" class="link-text">${resetLink}</a>
  `;

  try {
    await transport.sendMail({
      from: SMTP_FROM,
      to: email,
      subject: t.resetSubject,
      html: getEmailTemplate(content, lang),
      text: `${t.resetSubject}\n\n${t.resetMessage}\n${resetLink}`
    });
    console.log(`[Email] Reset sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send reset:', error);
    return false;
  }
}
