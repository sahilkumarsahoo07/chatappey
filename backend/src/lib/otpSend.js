import Mailjet from 'node-mailjet';
import nodemailer from 'nodemailer';

// Initialize Mailjet client if API keys are available
let mailjetClient = null;
if (process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY) {
    mailjetClient = new Mailjet({
        apiKey: process.env.MAILJET_API_KEY,
        apiSecret: process.env.MAILJET_SECRET_KEY
    });
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
 * - If MAILJET_API_KEY + MAILJET_SECRET_KEY are set + production: Uses Mailjet API
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
    const hasMailjetKeys = !!(process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY);

    // Use Mailjet only if in production AND API keys are available
    const useMailjet = isProduction && hasMailjetKeys;

    try {
        if (useMailjet) {
            // Use Mailjet API in production
            console.log('📧 Sending email via Mailjet API (Production)');

            const result = await mailjetClient
                .post('send', { version: 'v3.1' })
                .request({
                    Messages: [
                        {
                            From: {
                                Email: process.env.MAILJET_FROM_EMAIL || 'noreply@chatappey.com',
                                Name: 'Chat Appey'
                            },
                            To: [
                                {
                                    Email: to
                                }
                            ],
                            Subject: subject,
                            HTMLPart: html
                        }
                    ]
                });

            console.log('✅ Email sent successfully via Mailjet:', result.body);
            return { success: true, data: result.body };
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
        console.error(`❌ Error sending email via ${useMailjet ? 'Mailjet' : 'Gmail'}:`, error.message);
        throw error;
    }
};

export default mailjetClient;