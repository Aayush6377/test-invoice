import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to, 
            subject, 
            html
        });
        return true;
    } catch {
        return false;
    }
}

export default sendEmail;