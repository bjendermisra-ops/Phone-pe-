import qs from 'querystring';

export default async function handler(req, res) {
    const origin = req.headers.origin ? req.headers.origin : '*';
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

    try {
        const { name, amount, phone, email, seva, pan, address, returnUrl } = req.body;

        if (!name || !amount || !phone) { 
            return res.status(400).json({ error: 'Required fields missing: name, amount, phone' }); 
        }

        // 🔑 PhonePe V2 Credentials (Sandbox or Production)
        const isProduction = process.env.PHONEPE_ENV === "PRODUCTION";
        const clientId = process.env.PHONEPE_CLIENT_ID || "ISKCONISONLINE_260731175";
        const clientSecret = process.env.PHONEPE_CLIENT_SECRET || "YTE4YjFjODItMzQzMi00MDY0LTk5MmYtMWRiMTc5Y2ZhZDMz";
        const clientVersion = 1;

        const transactionId = "TXN" + Date.now();
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        // 🎯 Safe Receipt Return URL (Bypasses PhonePe back-loop)
        const host = req.headers.host || 'phone-pe-pi.vercel.app';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const encodedReturn = returnUrl ? encodeURIComponent(returnUrl) : encodeURIComponent(`${protocol}://${host}/index.html`);
        
        const redirectUrl = `${protocol}://${host}/receipt.html?status=success&name=${encodeURIComponent(name)}&amount=${amount}&seva=${encodeURIComponent(seva || 'Seva Donation')}&phone=${phone}&transactionId=${transactionId}&pan=${encodeURIComponent(pan || '')}&address=${encodeURIComponent(address || '')}&returnUrl=${encodedReturn}`;

        // 1. Generate OAuth Access Token
        const tokenPayload = new URLSearchParams();
        tokenPayload.append("client_id", clientId);
        tokenPayload.append("client_version", clientVersion.toString());
        tokenPayload.append("client_secret", clientSecret);
        tokenPayload.append("grant_type", "client_credentials");

        let accessToken = null;
        const tokenHost = isProduction ? "https://api.phonepe.com/apis/pg" : "https://api-preprod.phonepe.com/apis/pg-sandbox";

        try {
            const tokenUrl = `${tokenHost}/v1/oauth/token`;
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
                const fallbackTokenUrl = isProduction ? "https://api.phonepe.com/apis/apphub/v1/oauth/token" : "https://api-preprod.phonepe.com/apis/apphub/v1/oauth/token";
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
            return res.status(500).json({ error: "Failed to generate PhonePe PG OAuth Token." }); 
        }

        // 2. Create Universal Android + iOS Checkout Pay Link
        const payUrl = `${tokenHost}/checkout/v2/pay`;
        const paymentPayload = {
            merchantOrderId: transactionId,
            amount: amountInPaise,
            expireAfter: 1200,
            metaData: {
                donorName: name,
                donorPhone: phone,
                sevaType: seva || "General Seva"
            },
            paymentFlow: { 
                type: "PG_CHECKOUT", 
                message: `Seva Donation for ${seva || 'ISKCON Bhuvaikuntha'}`,
                merchantUrls: { 
                    redirectUrl: redirectUrl 
                } 
            }
        };

        const payResponse = await fetch(payUrl, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": "O-Bearer " + accessToken 
            },
            body: JSON.stringify(paymentPayload)
        });

        const payData = await payResponse.json();
        if (payResponse.status === 200 && payData.redirectUrl) {
            return res.status(200).json({ payment_url: payData.redirectUrl });
        } else {
            console.error("PhonePe Pay Error:", payData);
            return res.status(500).json({ error: payData.message || "PhonePe Pay-link generation failed." });
        }
    } catch (error) {
        console.error("Handler Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
