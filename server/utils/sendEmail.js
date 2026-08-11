import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  // Create a transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    auth: {
      user: process.env.SMTP_EMAIL || 'ethereal.user@ethereal.email',
      pass: process.env.SMTP_PASSWORD || 'ethereal_password',
    },
  });

  // Define email options
  const message = {
    from: `${process.env.FROM_NAME || 'Realtime Chat Admin'} <${process.env.FROM_EMAIL || 'noreply@chat.com'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  // Send the email
  const info = await transporter.sendMail(message);
  console.log('Message sent: %s', info.messageId);
};

export default sendEmail;
