import { Resend } from 'resend';
import nodemailer from 'nodemailer';

const resend = new Resend(process.env.RESEND_API_KEY);

// Gmail SMTP transporter for local development
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
 * - Production (Render): Uses Resend API (SMTP is blocked on Render)
 * - Development (Local): Uses Gmail SMTP
 * 
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @returns {Promise} - Email send result
 */
export const sendEmail = async ({ to, subject, html }) => {
    const isProduction = process.env.NODE_ENV === 'production';

    try {
        if (isProduction) {
            // Use Resend API in production (Render blocks SMTP)
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
            // Use Gmail SMTP in development (works locally)
            console.log('📧 Sending email via Gmail SMTP (Development)');
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
        console.error(`❌ Error sending email via ${isProduction ? 'Resend' : 'Gmail'}:`, error);
        throw error;
    }
};

export default resend;