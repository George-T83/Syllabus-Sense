import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { renderPasswordResetEmailHtml } from '@/lib/email/passwordResetEmailTemplate';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    if (!adminAuth) {
      return NextResponse.json(
        { error: 'Firebase Admin Auth is not initialized.' },
        { status: 500 },
      );
    }

    const actionCodeSettings = {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000/auth/action',
      handleCodeInApp: true,
    };

    const resetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);
    const html = renderPasswordResetEmailHtml({ email, resetLink });

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Syllabus Sense" <noreply@syllabussense.com>',
        to: email,
        subject: 'Reset your Syllabus Sense Password',
        html,
      });
    }

    return NextResponse.json({ success: true, resetLink, html });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate reset link.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
