const nodemailer = require('nodemailer');
const htmlToText = require('html-to-text');

const sendEmail = async (options) => {
  // 1) Create a transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,

    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
    // tls: { rejectUnauthorized: false },
  });
  // 2) Define email options
  const mailOptions = {
    from: 'MARWAN YASSER <natours@gmail.com>',
    to: options.email,
    subject: options.subject,
    // text: htmlToText(options.message),
    html: options.message,
    // html:
  };
  // 3) Send the EMAIL
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
