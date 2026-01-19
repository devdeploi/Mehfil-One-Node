const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

const sendSms = async (to, body) => {
    try {
        if (!to) {
            console.error('No phone number provided for SMS');
            return false;
        }

        console.log(`Attempting to send SMS to ${to}`);

        const message = await client.messages.create({
            body: body,
            from: fromPhone,
            to: to
        });

        console.log(`SMS sent successfully. SID: ${message.sid}`);
        return true;
    } catch (error) {
        console.error('Error sending SMS:', error.message);
        return false;
    }
};

module.exports = sendSms;
