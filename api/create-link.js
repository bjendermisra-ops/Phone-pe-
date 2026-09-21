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

        // 🔑 Real Production Credentials (from Nitin Prabhu)
        const isProduction = true;
        const clientId = "SU2608031047283544010005";
        const clientSecret = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const clientVersion = 1;

        const transactionId = "TXN" + Date.now();
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        // Safe Receipt Return URL
        const host = req.headers.host || 'phone-pe-pi.vercel.app';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const encodedReturn = returnUrl ? encodeURIComponent(returnUrl) : encodeURIComponent(`${protocol}://${host}/index.html`);
        
        const redirectUrl = `${protocol}://${host}/receipt.html?status=success&name=${encodeURIComponent(name)}&amount=${amount}&seva=${encodeURIComponent(seva || 'Seva Donation')}&phone=${phone}&transactionId=${transactionId}&pan=${encodeURIComponent(pan || '')}&address=${encodeURIComponent(address || '')}&returnUrl=${encodedReturn}`;

        // 1. Generate OAuth Access Token (Real Production)
        const tokenPayload = new URLSearchParams();
        tokenPayload.append("client_id", clientId);
        tokenPayload.append("client_version", clientVersion.toString());
        tokenPayload.append("client_secret", clientSecret);
        tokenPayload.append("grant_type", "client_credentials");

        let accessToken = null;
        const tokenHost = "https://api.phonepe.com/apis/pg";

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

        // Fallback production token endpoints
        if (!accessToken) {
            try {
                const fallbackTokenUrl = "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";
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
            try {
                const fallbackTokenUrl2 = "https://api.phonepe.com/apis/apphub/v1/oauth/token";
                const fallbackResponse2 = await fetch(fallbackTokenUrl2, { 
                    method: "POST", 
                    headers: { "Content-Type": "application/x-www-form-urlencoded" }, 
                    body: tokenPayload.toString() 
                });
                const fallbackData2 = await fallbackResponse2.json();
                if (fallbackResponse2.status === 200 && fallbackData2.access_token) { 
                    accessToken = fallbackData2.access_token; 
                }
            } catch (fallbackErr2) {}
        }

        if (!accessToken) { 
            return res.status(500).json({ error: "Failed to generate PhonePe Live OAuth Token. Please check client secret." }); 
        }

        // 2. Create Live Universal Pay Link (Exact same payload structure as your test)
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
            // Real reason frontend ko return karega
            return res.status(500).json({ 
                error: payData.message || "PhonePe Pay-link generation failed.", 
                phonepe_response: payData 
            });
        }
    } catch (error) {
        console.error("Handler Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
