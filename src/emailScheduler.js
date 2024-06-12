// emailScheduler.js

const nodemailer = require('nodemailer');

// Create a SMTP transporter object
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'vedhavarshini.y111@gmail.com',
        pass: 'nokq ldik olho ztpg'
    }
});
// Function to send email
function sendEmail(receiver, subject, text) {
    transporter.sendMail({
        from: 'vedhavarshini.y111@gmail.com',
        to: receiver,
        subject: subject,
        text: text
    }, function(err, info) {
        if (err) console.error('Error:', err);
        else console.log('Email sent:', info.response);
        console.log(`Sending email to ${receiver} with subject: ${subject}`);
    });
}

module.exports = { transporter,sendEmail }; // Export the transporter object
