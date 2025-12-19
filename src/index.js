import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

// Chat endpoint (existing)
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        // Take last 7 messages only
        const limitedMessages = messages.slice(-7);

        const completion = await groq.chat.completions.create({
            messages: limitedMessages,
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
            max_tokens: 1024,
        });

        const reply = completion.choices[0]?.message?.content || 'No response';

        res.json({ reply });
    } catch (error) {
        console.error('Groq API Error:', error);
        res.status(500).json({ error: 'Failed to get AI response' });
    }
});

// Feedback endpoint (NEW)
app.post('/api/feedback', async (req, res) => {
    try {
        const { feedback, userEmail, username, isPro, timestamp, platform } = req.body;

        // Validate feedback
        if (!feedback || feedback.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Feedback is required'
            });
        }

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: process.env.GMAIL_USER,
            subject: `BloatFest Feedback from ${username}`,
            html: `
                <h2>New Feedback Received</h2>
                <p><strong>From:</strong> ${username} (${isPro ? 'Pro User ⭐' : 'Free User'})</p>
                <p><strong>Contact Email:</strong> ${userEmail}</p>
                <p><strong>Platform:</strong> ${platform}</p>
                <p><strong>Time:</strong> ${new Date(timestamp).toLocaleString()}</p>
                <hr>
                <h3>Feedback:</h3>
                <p style="white-space: pre-wrap;">${feedback}</p>
            `,
        };

        await transporter.sendMail(mailOptions);

        console.log(`✅ Feedback sent from ${username}`);
        res.status(200).json({ success: true, message: 'Feedback sent successfully' });
    } catch (error) {
        console.error('Error sending feedback email:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send feedback',
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
    console.log(`📧 Email configured: ${process.env.GMAIL_USER ? 'Yes' : 'No'}`);
});