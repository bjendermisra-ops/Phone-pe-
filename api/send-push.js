import admin from 'firebase-admin';

// Initialize Firebase Admin SDK safely (Singleton Pattern)
if (!admin.apps.length) {
    try {
        const serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID || "iskcon-bhuvaikuntha",
            // Nayi Active Private Key (From your latest JSON)
            private_key: process.env.FIREBASE_PRIVATE_KEY 
                ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
                : "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDDHmvZu3bV8ttR\nHfcuzyEw6SlGacK+4H7Xe80IKczPkDiICJV2IyG4aQzNb/FIRaqTPsoaOWC1MAoR\nezxN0LvLiy+uNuhIuBjfQVXc2ZPAIpNNMsnaVlL1cH8Cc/yhmgdq/OdIh5EnvW6V\nHWHZssIfS3JYKL7RDQrLb5a2NdQR7YAn4N+9ckiCu5OPPzV+9m+LsNbbMmAX5kUE\nrFX3SWVE6a5/D66SFhy7+JVNcvsf6auq3CPw8vDV4KWq2deed2XZu4yblmE4gAaa\nivGIRCaSn1tmOduv646vXwoaT2jNe/EJatwpBoX1K7xtDLOeoh7Vrsq4IYp4MXMA\neHgF1ndrAgMBAAECggEAOs+ND2wfNf6E127SRdQdu3nTvIr9LX5KDRYeJxM+TeO4\n/luj/R86tzRGrRdMIQ4Ki2Y2EXBw8zvfFQTRmNzM9d1mijq3ic+fg49UW4RjMdra\nDj88MyioyZzWU311TJo6GSfQaH6gJFvHHH/mMfFc7ITXmrXxSd6F/eqNAS+5U4t8\njdE7aBIQ5ynyZ+/xQQUrsLSXtKtTRsHgHIUT6cbB34irWPQGn4HIgA8vqx9kNElb\nJKL4vk1qVoLzR6bVPt2IYtvAaYDYhykneq5AdlqCQTzGQ0A+MvXuHLw2PJtDFAZ4\nVBMCfDZxzkNdSR3zZ+w4NlKkgKAYkFFyxabotacvjQKBgQD30F6P+UduXLXgZ2m1\nnQVzLorjahX6o4DD3KNCkvM0reKmZlzjJB44V4ocCy3OvF1usCXtKID9SZJQ6sMv\ngeSZ3p4snvGCB2UFINNHtMShmvPB5NpxN5ncqo6JFAWaVNaWMTxTGos82szP8bd3\nGjKAZRrIRP6ZTPdZYUK+rq1qzQKBgQDJkG/6Jn/rjpOqkJblJNcngiathvXraW48\nDnT8XUjM61zDA1epLTQLbdZ/mun6X/1VCgdX7IeIsjCknQSckYMNz69WPOUgMp6S\nNJMElO920ZggrMz6ZEF7WJajoR/rFSdI1hqVRlNydhdQa8Pn3ArKXBc4/L+DODm0\nIgreMndbFwKBgQDAuHyB7TP/APy0yter1LSDUgPTPhJfvD4MlA8nXA7lvgEQtXSx\ndMpHuNSAYLU8HMNwrG6iVCiUUl4GrbwjuxmkDDvoqadaHxQR++gz0MJGh7Hf7XFw\nMPRoZv+4XSjKUAYeAaZPXspABkzXvryWVHpH3dkJPJbfc7q8+OWmU0QsVQKBgQC/\niBuPpXPanyHcawan+Ujlhvw/2kXmi8mvEcHCaNYbuu7rdEqhPI3+6kFwAgGh5AKz\nAxOVTfJAR6qHUZknOfJBdn9TQAwte0xI++JT8T5XNrULH4irygabMcP6+sl8th4d\nTS33eNskoehnh++ha+to/PcoNKu7Aft7Gvoex++4wwKBgEx8tITMDOP5eitygvWH\nB0/PXgIwPgt2vrtZGYkMDMDzhBO+CLRVI01Uxea05DftyAU0iBGKsOWGk3cVFG7c\nUnxSpYlHFZfReLu1YZcEAOhjC6gXyRo5idqa4DXPQNIbWhf67siz4b6ax96d+oSz\nEqYw4td6qZMp3BhzofE+aMwq\n-----END PRIVATE KEY-----\n",
            client_email: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@iskcon-bhuvaikuntha.iam.gserviceaccount.com"
        };

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase admin init error:", error);
    }
}

export default async function handler(req, res) {
    // CORS Configuration
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

    try {
        const { title, body, imageUrl, actionUrl, topic } = req.body || {};
        if (!title || !body) {
            return res.status(400).json({ success: false, error: 'Title and Body are required' });
        }

        // ✅ Default topic ab "all" hai (Matching DevDarshan App)
        const targetTopic = topic || "all";

        // 🚀 COMPLETE PAYLOAD: NOTIFICATION (FOR SYSTEM POPUP) + DATA + ANDROID HEADERS
        const message = {
            topic: targetTopic,
            
            // 🔔 1. YEH SYSTEM TRAY ME NOTIFICATION POP KARTA HAI (MUST-HAVE)
            notification: {
                title: String(title),
                body: String(body),
                ...(imageUrl ? { image: String(imageUrl) } : {})
            },

            // 📦 2. Background Data payload
            data: {
                title: String(title),
                body: String(body),
                image: imageUrl ? String(imageUrl) : "",
                actionUrl: actionUrl || "index.html"
            },

            // 🤖 3. Android High Priority & System Sound Config
            android: {
                priority: "high",
                directBootOk: true,
                notification: {
                    sound: "default",
                    channelId: "devdarshan_channel",
                    priority: "high",
                    defaultSound: true,
                    defaultVibrateTimings: true,
                    ...(imageUrl ? { image: String(imageUrl) } : {})
                }
            },
            // 🍏 4. Apple iOS APNs Alert
            apns: {
                headers: {
                    "apns-priority": "10",
                    "apns-push-type": "alert"
                },
                payload: {
                    aps: {
                        alert: {
                            title: String(title),
                            body: String(body)
                        },
                        sound: "default",
                        badge: 1
                    }
                },
                fcm_options: {
                    ...(imageUrl ? { image: String(imageUrl) } : {})
                }
            }
        };

        const response = await admin.messaging().send(message);
        return res.status(200).json({ success: true, messageId: response, topic: targetTopic });

    } catch (error) {
        console.error("Push Notification Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
