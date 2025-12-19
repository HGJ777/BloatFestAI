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

/* =========================
   Groq Client
========================= */
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/* =========================
   Health Check
========================= */
app.get('/', (req, res) => {
    res.send('BloatFest backend running');
});

/* =========================
   CHAT ENDPOINTS
========================= */

/**
 * PRIMARY CHAT ENDPOINT
 * (used by frontend)
 */
app.post('/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages must be an array' });
        }

        const limitedMessages = messages.slice(-7);

        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: limitedMessages,
            temperature: 0.7,
            max_tokens: 1024,
        });

        const reply =
            completion.choices?.[0]?.message?.content ?? 'No response';

        res.json({ reply });
    } catch (error) {
        console.error('Groq API Error:', error);
        res.status(500).json({ error: 'Failed to get AI response' });
    }
});

/**
 * BACKWARD-COMPATIBILITY ALIAS
 * (/api/chat still works)
 */
app.post('/api/chat', async (req, res) => {
    req.url = '/chat';
    app.handle(req, res);
});

/* =========================
   FEEDBACK ENDPOINT
========================= */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

app.post('/api/feedback', async (req, res) => {
    try {
        const {
            feedback,
            userEmail,
            username,
            isPro,
            timestamp,
            platform,
        } = req.body;

        if (!feedback || !feedback.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Feedback is required',
            });
        }

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: process.env.GMAIL_USER,
            subject: `BloatFest Feedback from ${username}`,
            html: `
        <h2>New Feedback Received</h2>
        <p><strong>User:</strong> ${username} (${isPro ? 'Pro ⭐' : 'Free'})</p>
        <p><strong>Email:</strong> ${userEmail}</p>
        <p><strong>Platform:</strong> ${platform}</p>
        <p><strong>Time:</strong> ${new Date(timestamp).toLocaleString()}</p>
        <hr />
        <pre>${feedback}</pre>
      `,
        };

        await transporter.sendMail(mailOptions);

        res.json({ success: true });
    } catch (error) {
        console.error('Feedback error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send feedback',
        });
    }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT}`);
    console.log(
        `🤖 Groq key loaded: ${Boolean(process.env.GROQ_API_KEY)}`
    );
    console.log(
        `📧 Email configured: ${Boolean(process.env.GMAIL_USER)}`
    );
});
