const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD 
    }
});

const sendSecurityAlert = async (type, details, imageUrl = null) => {
    let subject = type === 'FACE_UNKNOWN' ? '🚨 Security Alert: Unknown Person Detected' : '🔔 Security Update';
    
    let htmlContent = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #ef4444;">${subject}</h2>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Details:</strong> ${details}</p>
            ${imageUrl ? `<img src="${imageUrl}" style="max-width: 100%; border-radius: 8px;" />` : ''}
            <p><a href="${process.env.DASHBOARD_URL || 'http://localhost:3000'}">View Live Dashboard</a></p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"SecureVision" <${process.env.EMAIL_USER}>`,
            to: process.env.ALERT_RECIPIENT_EMAIL,
            subject: subject,
            html: htmlContent
        });
        console.log(`Alert sent for: ${type}`);
    } catch (error) {
        console.error("Failed to send alert email:", error);
    }
};

module.exports = { sendSecurityAlert };