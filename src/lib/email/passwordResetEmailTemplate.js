/**
 * Renders an HTML password reset email template with Syllabus Sense brand colors,
 * responsive typography, logo header, gradient action button, and security footer.
 */
function renderPasswordResetEmailHtml({ email, resetLink }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your Syllabus Sense Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 36px 32px; text-align: center;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center">
                <tr>
                  <td style="background-color: rgba(255, 255, 255, 0.2); border-radius: 12px; padding: 10px 16px;">
                    <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">Syllabus Sense</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 20px 0 0 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">Password Reset Request</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                Hello,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                We received a request to reset the password for your Syllabus Sense account (<strong style="color: #0f172a;">${email}</strong>). Click the button below to choose a new password:
              </p>

              <!-- Action Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 9999px; box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35); text-align: center;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                If you did not request a password reset, you can safely ignore this email — your account remains completely secure.
              </p>

              <div style="margin-top: 20px; padding: 14px 16px; background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #475569;">Button not working? Copy and paste this link:</p>
                <p style="margin: 0; font-size: 11px; color: #6366f1; word-break: break-all; line-height: 1.4;">${resetLink}</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; font-weight: 600; color: #64748b;">
                Syllabus Sense — Your Whole Semester, Actually Organized.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { renderPasswordResetEmailHtml };
