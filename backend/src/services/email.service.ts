import nodemailer from 'nodemailer'
import { logInfo, logError } from '../config/logger'

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }
  return transporter
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const from = `"Sushimas ERP" <${process.env.SMTP_USER}>`
  try {
    await getTransporter().sendMail({ from, to, subject, html })
    logInfo('Email sent', { to, subject })
  } catch (error) {
    logError('Failed to send email', { to, subject, error })
    throw error
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #1E1215; border-radius: 16px; border: 1px solid #D4A84333;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 40px; height: 64px; background: #C53030; border-radius: 8px; border: 4px solid #D4A843; line-height: 18px; padding: 8px 0;">
          <span style="display: block; color: white; font-weight: 900; font-size: 16px;">S</span>
          <span style="display: block; color: white; font-weight: 900; font-size: 16px;">I</span>
          <span style="display: block; color: white; font-weight: 900; font-size: 16px;">S</span>
        </div>
        <h2 style="color: #ffffff; margin: 16px 0 4px;">Reset Password</h2>
        <p style="color: #9CA3AF; font-size: 14px; margin: 0;">Sushimas Internal System</p>
      </div>
      <p style="color: #D1D5DB; font-size: 14px; line-height: 1.6;">
        Anda menerima email ini karena ada permintaan reset password untuk akun Anda.
        Klik tombol di bawah untuk membuat password baru:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: #C53030; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Reset Password
        </a>
      </div>
      <p style="color: #6B7280; font-size: 12px; line-height: 1.5;">
        Link ini berlaku selama 1 jam. Jika Anda tidak meminta reset password, abaikan email ini.
      </p>
      <hr style="border: none; border-top: 1px solid #374151; margin: 24px 0;" />
      <p style="color: #4B5563; font-size: 11px; text-align: center;">
        &copy; ${new Date().getFullYear()} PT Surya Mas Pratama
      </p>
    </div>
  `
  await sendEmail(to, 'Reset Password — Sushimas ERP', html)
}
