import admin from 'firebase-admin';

// Initialize Firebase Admin with production-grade singleton & safety checks
if (!admin.apps.length) {
    try {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        
        // Fallback private key if env variable is not set
        if (!privateKey) {
            privateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDDHmvZu3bV8ttR\nHfcuzyEw6SlGacK+4H7Xe80IKczPkDiICJV2IyG4aQzNb/FIRaqTPsoaOWC1MAoR\nezxN0LvLiy+uNuhIuBjfQVXc2ZPAIpNNMsnaVlL1cH8Cc/yhmgdq/OdIh5EnvW6V\nHWHZssIfS3JYKL7RDQrLb5a2NdQR7YAn4N+9ckiCu5OPPzV+9m+LsNbbMmAX5kUE\nrFX3SWVE6a5/D66SFhy7+JVNcvsf6auq3CPw8vDV4KWq2deed2XZu4yblmE4gAaa\nivGIRCaSn1tmOduv646vXwoaT2jNe/EJatwpBoX1K7xtDLOeoh7Vrsq4IYp4MXMA\neHgF1ndrAgMBAAECggEAOs+ND2wfNf6E127SRdQdu3nTvIr9LX5KDRYeJxM+TeO4\n/luj/R86tzRGrRdMIQ4Ki2Y2EXBw8zvfFQTRmNzM9d1mijq3ic+fg49UW4RjMdra\nDj88MyioyZzWU311TJo6GSfQaH6gJFvHHH/mMfFc7ITXmrXxSd6F/eqNAS+5U4t8\njdE7aBIQ5ynyZ+/xQQUrsLSXtKtTRsHgHIUT6cbB34irWPQGn4HIgA8vqx9kNElb\nJKL4vk1qVoLzR6bVPt2IYtvAaYDYhykneq5AdlqCQTzGQ0A+MvXuHLw2PJtDFAZ4\nVBMCfDZxzkNdSR3zZ+w4NlKkgKAYkFFyxabotacvjQKBgQD30F6P+UduXLXgZ2m1\nnQVzLorjahX6o4DD3KNCkvM0reKmZlzjJB44V4ocCy3OvF1usCXtKID9SZJQ6sMv\ngeSZ3p4snvGCB2UFINNHtMShmvPB5NpxN5ncqo6JFAWaVNaWMTxTGos82szP8bd3\nGjKAZRrIRP6ZTPdZYUK+rq1qzQKBgQDJkG/6Jn/rjpOqkJblJNcngiathvXraW48\nDnT8XUjM61zDA1epLTQLbdZ/mun6X/1VCgdX7IeIsjCknQSckYMNz69WPOUgMp6S\nNJMElO920ZggrMz6ZEF7WJajoR/rFSdI1hqVRlNydhdQa8Pn3ArKXBc4/L+DODm0\nIgreMndbFwKBgQDAuHyB7TP/APy0yter1LSDUgPTPhJfvD4MlA8nXA7lvgEQtXSx\ndMpHuNSAYLU8HMNwrG6iVCiUUl4GrbwjuxmkDDvoqadaHxQR++gz0MJGh7Hf7XFw\nMPRoZv+4XSjKUAYeAaZPXspABkzXvryWVHpH3dkJPJbfc7q8+OWmU0QsVQKBgQC/\niBuPpXPanyHcawan+Ujlhvw/2kXmi8mvEcHCaNYbuu7rdEqhPI3+6kFwAgGh5AKz\nAxOVTfJAR6qHUZknOfJBdn9TQAwte0xI++JT8T5XNrULH4irygabMcP6+sl8th4d\nTS33eNskoehnh++ha+to/PcoNKu7Aft7Gvoex++4wwKBgEx8tITMDOP5eitygvWH\nB0/PXgIwPgt2vrtZGYkMDMDzhBO+CLRVI01Uxea05DftyAU0iBGKsOWGk3cVFG7c\nUnxSpYlHFZfReLu1YZcEAOhjC6gXyRo5idqa4DXPQNIbWhf67siz4b6ax96d+oSz\nEqYw4td6qZMp3BhzofE+aMwq\n-----END PRIVATE KEY-----\n";
        } else {
            privateKey = privateKey.replace(/\\n/g, '\n');
        }

        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID || "iskcon-bhuvaikuntha",
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@iskcon-bhuvaikuntha.iam.gserviceaccount.com",
            privateKey: privateKey
        };

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase admin init error:", error.message);
    }
}

export default async function handler(req, res) {
    // 🌐 Full CORS Headers for Mobile APK & Web
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

    try {
        const { title, body, imageUrl, actionUrl, topic, targetLeaderId, leaderName, tokens } = req.body || {};
        
        if (!title || !body) {
            return res.status(400).json({ success: false, error: 'Title and Body are required' });
        }

        // Clean & Normalize Topic (100% match with MainActivity.java & MyFCMService.java)
        let targetTopic = (topic || "temple_all").trim();
        targetTopic = targetTopic.replace(/^\/topics\//, '');
        targetTopic = targetTopic.replace(/[^a-zA-Z0-9-_.~%]+/g, '_');

        const imgUrl = (imageUrl && imageUrl.trim().startsWith('http')) ? imageUrl.trim() : "";
        const targetScreen = actionUrl || "index.html";

        // Construct 100% Production-Grade FCM Payload matching MyFCMService.java perfectly
        const payloadData = {
            title: String(title),
            body: String(body),
            image: imgUrl,
            imageUrl: imgUrl,
            page: String(targetScreen),    // Read by MyFCMService.java
            url: String(targetScreen),     // Read by MyFCMService.java
            actionUrl: String(targetScreen),
            targetLeaderId: targetLeaderId ? String(targetLeaderId) : "",
            leaderName: leaderName ? String(leaderName) : "",
            timestamp: String(Date.now())
        };

        const androidConfig = {
            priority: "high",
            directBootOk: true,
            notification: {
                sound: "default",
                channelId: "padyatra_loud_v5", // 🔥 100% MATCHES YOUR JAVA CODE!
                priority: "high",
                defaultSound: true,
                defaultVibrateTimings: true,
                visibility: "public",          // ✅ STRICT LOWERCASE (Fixes Fatal FCM Crash)
                ...(imgUrl ? { image: imgUrl } : {})
            }
        };

        const apnsConfig = {
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
                    badge: 1,
                    "content-available": 1
                }
            },
            fcmOptions: {
                ...(imgUrl ? { imageUrl: imgUrl } : {})
            }
        };

        let response = null;

        // 1. Direct Multicast Push to Devotee Tokens (if array provided)
        if (tokens && Array.isArray(tokens) && tokens.length > 0) {
            const validTokens = tokens.filter(t => t && typeof t === 'string' && t.trim().length > 10);
            if (validTokens.length > 0) {
                try {
                    response = await admin.messaging().sendEachForMulticast({
                        tokens: validTokens,
                        notification: {
                            title: String(title),
                            body: String(body),
                            ...(imgUrl ? { imageUrl: imgUrl } : {})
                        },
                        data: payloadData,
                        android: androidConfig,
                        apns: apnsConfig
                    });
                } catch (tokenErr) {
                    console.warn("Direct token multicast warning:", tokenErr);
                }
            }
        }

        // 2. High-Performance Instant Topic Push (1L - 5L Scale)
        const topicMessage = {
            topic: targetTopic,
            notification: {
                title: String(title),
                body: String(body),
                ...(imgUrl ? { imageUrl: imgUrl } : {})
            },
            data: payloadData,
            android: androidConfig,
            apns: apnsConfig
        };

        const topicResponse = await admin.messaging().send(topicMessage);

        return res.status(200).json({ 
            success: true, 
            messageId: topicResponse, 
            topic: targetTopic,
            channelId: "padyatra_loud_v5",
            status: "Delivered to FCM Topic & Java Channel successfully"
        });

    } catch (error) {
        console.error("Push Dispatch Fatal Error:", error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || "Failed to dispatch FCM push notification" 
        });
    }
}
