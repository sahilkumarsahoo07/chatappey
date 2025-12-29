import { Resend } from 'resend';
import nodemailer from 'nodemailer';

// Only initialize Resend if API key is available
let resend = null;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
}

// Gmail SMTP transporter for local development or fallback
const gmailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    logger: process.env.NODE_ENV !== 'production',
    debug: process.env.NODE_ENV !== 'production',
});

/**
 * Send email using appropriate service based on environment
 * - If RESEND_API_KEY is set + production: Uses Resend API
 * - Otherwise: Uses Gmail SMTP (fallback)
 * 
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @returns {Promise} - Email send result
 */
export const sendEmail = async ({ to, subject, html }) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const hasResendKey = !!process.env.RESEND_API_KEY;

    // Use Resend only if in production AND API key is available
    const useResend = isProduction && hasResendKey;

    try {
        if (useResend) {
            // Use Resend API in production
            console.log('📧 Sending email via Resend API (Production)');
            const data = await resend.emails.send({
                from: `Chat Appey <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
                to: [to],
                subject: subject,
                html: html,
            });

            console.log('✅ Email sent successfully via Resend:', data);
            return { success: true, data };
        } else {
            // Use Gmail SMTP in development or as fallback
            console.log(`📧 Sending email via Gmail SMTP (${isProduction ? 'Fallback' : 'Development'})`);
            const info = await gmailTransporter.sendMail({
                from: `"Chat Appey" <${process.env.EMAIL_USER}>`,
                to: to,
                subject: subject,
                html: html,
            });

            console.log('✅ Email sent successfully via Gmail:', info.messageId);
            return { success: true, messageId: info.messageId };
        }
    } catch (error) {
        console.error(`❌ Error sending email via ${useResend ? 'Resend' : 'Gmail'}:`, error.message);
        throw error;
    }
};

export default resend;