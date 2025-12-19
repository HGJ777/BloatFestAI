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

/* =========================
   Health Check
========================= */
app.get('/', (_, res) => {
    res.send('BloatFest backend is running');
});

app.get('/health', (_, res) => {
    res.json({ status: 'ok' });
});

/* =========================
   CHAT
========================= */
app.post('/chat', async (req, res) => {
    try {
        let { messages } = req.body;

        if (!Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages must be an array' });
        }

        // 🔒 SANITIZE INPUT (CRITICAL)
        messages = messages
            .filter(
                m =>
                    typeof m?.content === 'string' &&
                    m.content.trim().length > 0 &&
                    ['system', 'user', 'assistant'].includes(m.role)
            )
            .map(m => ({
                role: m.role,
                content: m.content.trim(),
            }))
            .slice(-5); // hard cap

        if (messages.length === 0) {
            return res.json({
                reply: 'I’m here. What would you like to explore?',
            });
        }

        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.7,
            max_tokens: 800,
        });

        const rawReply = completion?.choices?.[0]?.message?.content;

        const reply =
            typeof rawReply === 'string' && rawReply.trim().length > 0
                ? rawReply.trim()
                : 'I’m here, but I didn’t generate a response this time. Please try again.';

        console.log('AI reply:', reply);

        res.json({ reply });
    } catch (error) {
        console.error('Groq API Error FULL:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data,
        });

        res.status(500).json({
            error: 'AI request failed',
            details: error.message,
        });
    }
});

/* Backward compatibility */
app.post('/api/chat', (req, res) => {
    req.url = '/chat';
    app.handle(req, res);
});

/* =========================
   FEEDBACK (unchanged)
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
        const { feedback } = req.body;
        if (!feedback?.trim()) {
            return res.status(400).json({ success: false });
        }
        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: process.env.GMAIL_USER,
            subject: 'BloatFest Feedback',
            text: feedback,
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT}`);
    console.log(`🤖 Groq key loaded: ${Boolean(process.env.GROQ_API_KEY)}`);
});
