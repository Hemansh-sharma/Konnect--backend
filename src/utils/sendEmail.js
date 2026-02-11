const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "911host911@gmail.com",
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const run = async (subject, body, toEmailId) => {
  try {
    const mailOptions = {
      from: "911host911@gmail.com",
      to: toEmailId,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
            <h2 style="color: #333;">${subject}</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">${body}</p>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="color: #999; font-size: 12px;">This is an automated email from Konnect. Please do not reply to this email.</p>
            </div>
          </div>
        </div>
      `,
    };

    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
};



module.exports = { run };
