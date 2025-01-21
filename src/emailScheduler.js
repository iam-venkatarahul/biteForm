// emailScheduler.js

const nodemailer = require('nodemailer');

// Create a SMTP transporter object
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Function to send email with text and html options
function sendEmail(receiver, subject, text, html) {
    let mailOptions = {
        from: 'vcareyou.biteform@gmail.com',
        to: receiver,
        subject: subject,
        text: text // Default to text content
    };

    // If html content is provided, include it in mailOptions
    if (html) {
        mailOptions.html = html;
    }

    transporter.sendMail(mailOptions, function(err, info) {
        if (err) {
            console.error('Error:', err);
        } else {
            console.log('Email sent:', info.response);
        }
        console.log(`Sending email to ${receiver} with subject: ${subject}`);
    });
}

module.exports = { transporter,sendEmail }; // Export the transporter object
