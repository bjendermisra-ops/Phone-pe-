import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID || "iskcon-bhuvaikuntha",
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
        })
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { token, topic } = req.body;
    if (!token || !topic) return res.status(400).json({ error: 'Missing token or topic' });

    try {
        await admin.messaging().subscribeToTopic([token], topic);
        return res.status(200).json({ success: true, message: `Subscribed to ${topic}` });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
