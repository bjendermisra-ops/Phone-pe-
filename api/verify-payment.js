import qs from 'querystring';
import admin from 'firebase-admin';

// Initialize Firebase Admin securely using your environment variables
if (!admin.apps.length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        })
    });
}
const db = admin.firestore();

// Secure WhatsApp Receipt Sender via DoubleTick API
async function sendWhatsAppReceipt(phone, name, seva, amount, txId) {
    const doubleTickUrl = "https://public.doubletick.io/whatsapp/message/template";
    const apiKey = "key_pdepb15p8SLYGrjoHFNX68hl6H8iDi7Mmq8JdzTidYqYFNJ4adCtVfpSoanH0uNIlWfpoIvJdvezN2RdyQPQiTuO6wpRlXDSsNNRut4CXTKTWpSkbNHFhT6g53tNLWBI1NmX6Lqy4TKD7N30xW7ZlV9diDqRnu40BIUX3PU8jW9ckrTAMLqeo8jobTxNpMcYAQLhMbRuZoM5CJ5EoXxxLk8L4XQzXoL229XOAFloUlCJ4Xabstw3tk9qvcte";
    const senderNumber = "919226167380";
    const templateName = "app_registration"; // Approved template bypass method [1.1.2]

    // Formatted Receipt text pushed directly into single placeholder [1.1.2, 1.1.6]
    const receiptMessage = `*Hare Krishna!* 🙏\n\nDear *${name}*,\nThank you for your generous contribution of *₹${amount}/-* towards *${seva}* at ISKCON Bhuvaikuntha.\n\n*Transaction Details*:\n• *Tx ID:* ${txId}\n• *Date:* ${new Date().toLocaleDateString('en-IN')}\n\nMay the Lord bless you! 🌸`;

    const cleanPhone = phone.trim().startsWith("91") ? phone.trim() : "91" + phone.trim();

    const payload = {
        "messages": [
            {
                "from": senderNumber,
                "to": cleanPhone,
                "content": {
                    "language": "en",
                    "templateName": templateName,
                    "templateData": {
                        "body": {
                            "placeholders": [
                                receiptMessage // dynamic receipt message [1.1.6]
                            ]
                        }
                    }
                }
            }
        ]
    };

    try {
        await fetch(doubleTickUrl, {
            method: "POST",
            headers: {
                "Authorization": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        console.log("WhatsApp receipt sent successfully to: " + cleanPhone);
    } catch (e) {
        console.error("WhatsApp dispatcher failure: ", e);
    }
}

export default async function handler(req, res) {
    const origin = req.headers.origin ? req.headers.origin : '*';
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { payment_id, name, amount, seva, phone } = req.method === 'POST' ? req.body : req.query;

        if (!payment_id) {
            return res.status(400).json({ error: 'Transaction ID / UTR is required.' });
        }

        const cleanTxId = payment_id.trim();
        const decodedName = name ? decodeURIComponent(name).trim() : 'Anonymous Donor';
        const decodedSeva = seva ? decodeURIComponent(seva).trim() : 'General Donation';
        const donorPhone = phone ? phone.trim() : 'N/A';

        // PhonePe V2 Sandbox Credentials
        const clientId = "ISKCONISONLINE_260731175";
        const clientSecret = "YTE4YjFjODItMzQzMi00MDY0LTk5MmYtMWRiMTc5Y2ZhZDMz";
        const clientVersion = 1;
        const merchantId = "ISKCONISONLINE";

        const tokenPayload = new URLSearchParams();
        tokenPayload.append("client_id", clientId);
        tokenPayload.append("client_version", clientVersion.toString());
        tokenPayload.append("client_secret", clientSecret);
        tokenPayload.append("grant_type", "client_credentials");

        let accessToken = null;

        // --- STEP 1: Generate OAuth Token ---
        try {
            const tokenUrl = "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";
            const tokenResponse = await fetch(tokenUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: tokenPayload.toString()
            });

            const tokenData = await tokenResponse.json();
            if (tokenResponse.status === 200 && tokenData.access_token) {
                accessToken = tokenData.access_token;
            }
        } catch (err) {}

        if (!accessToken) {
            try {
                const fallbackTokenUrl = "https://api-preprod.phonepe.com/apis/apphub/v1/oauth/token";
                const fallbackResponse = await fetch(fallbackTokenUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenPayload.toString()
                });

                const fallbackData = await fallbackResponse.json();
                if (fallbackResponse.status === 200 && fallbackData.access_token) {
                    accessToken = fallbackData.access_token;
                }
            } catch (fallbackErr) {}
        }

        if (!accessToken) {
            return res.status(500).json({ error: "Failed to generate status OAuth token." });
        }

        // STEP 2: Call V2 Sandbox Status Check API
        const statusUrl = `https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/${cleanTxId}/status`;

        const response = await fetch(statusUrl, {
            method: "GET",
            headers: {
                "Authorization": "O-Bearer " + accessToken,
                "X-MERCHANT-ID": merchantId,
                "accept": "application/json"
            }
        });

        const data = await response.json();

        // PhonePe V2 returns COMPLETED or SUCCESS status
        if (response.status === 200 && (data.state === "COMPLETED" || data.state === "SUCCESS")) {
            
            // --- SCAM PROTECTION: Check if transaction already processed ---
            const donationsRef = db.collection('donations');
            const docCheck = await donationsRef.doc(cleanTxId).get();

            if (!docCheck.exists) {
                // 1. Write the transaction securely into Firestore [1.1.2, 1.1.8]
                await donationsRef.doc(cleanTxId).set({
                    name: decodedName,
                    amount: Number(amount),
                    seva: decodedSeva,
                    paymentId: cleanTxId,
                    contact: donorPhone,
                    date: admin.firestore.FieldValue.serverTimestamp() // Firestore Real-time server timestamp [1.1.8]
                });

                // 2. Send dynamic secure WhatsApp Receipt via DoubleTick [1.1.2]
                if (donorPhone !== 'N/A') {
                    await sendWhatsAppReceipt(donorPhone, decodedName, decodedSeva, amount, cleanTxId);
                }
            }

            return res.status(200).json({ 
                status: 'success', 
                message: 'Transaction verified and securely logged in database!',
                verified_payment_id: cleanTxId,
                payment_details: {
                    contact: donorPhone,
                    method: 'PHONEPE V2'
                }
            });
        } else {
            return res.status(400).json({ 
                error: `PhonePe Status: ${data.state || 'FAILED'}. message: ${data.message || ''}` 
            });
        }

    } catch (error) {
        console.error("Verification server error: ", error);
        return res.status(500).json({ error: 'Server PhonePe V2 status verification failed.' });
    }
}
