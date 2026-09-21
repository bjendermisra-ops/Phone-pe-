export default async function handler(req, res) {
    const origin = req.headers.origin || '*';
    if (origin !== '*') {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { name, amount, phone, seva } = req.body;

        if (!name || !amount || !phone) { 
            return res.status(400).json({ error: 'Required fields missing: name, amount, phone' }); 
        }

        const clientId = process.env.PHONEPE_CLIENT_ID || "SU2608031047283544010005";
        const clientSecret = process.env.PHONEPE_CLIENT_SECRET || "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const merchantId = process.env.PHONEPE_MERCHANT_ID || "ISKCONISONLINE";
        const clientVersion = 1;

        // Transaction ID: Alphanumeric only (max 35 chars)
        const transactionId = "TXN" + Date.now();
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        if (isNaN(amountInPaise) || amountInPaise < 100) {
            return res.status(400).json({ error: 'Minimum amount must be at least ₹1 (100 paise)' });
        }

        const host = req.headers.host || 'phone-pe-pi.vercel.app';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        
        // Clean Redirect URL (Only orderId)
        const redirectUrl = `${protocol}://${host}/receipt.html?orderId=${transactionId}`;

        // 1. Get Live OAuth Token
        const tokenPayload = new URLSearchParams({
            client_id: clientId,
            client_version: clientVersion.toString(),
            client_secret: clientSecret,
            grant_type: "client_credentials"
        });

        const tokenEndpoints = [
            "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
            "https://api.phonepe.com/apis/pg/v1/oauth/token",
            "https://api.phonepe.com/apis/apphub/v1/oauth/token"
        ];

        let accessToken = null;
        for (const endpoint of tokenEndpoints) {
            try {
                const tokenRes = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenPayload.toString()
                });
                const tokenJson = await tokenRes.json();
                if (tokenRes.ok && tokenJson.access_token) {
                    accessToken = tokenJson.access_token;
                    break;
                }
            } catch (e) {}
        }

        if (!accessToken) {
            return res.status(500).json({ error: "Failed to generate PhonePe PG OAuth Token." });
        }

        // 2. Strict PhonePe V2 Payload (Notice: metaInfo with udf1/udf2, NOT metaData)
        const payUrl = "https://api.phonepe.com/apis/pg/checkout/v2/pay";
        const paymentPayload = {
            merchantOrderId: transactionId,
            amount: amountInPaise,
            expireAfter: 1200,
            metaInfo: {
                udf1: String(name).slice(0, 50),
                udf2: String(phone).slice(0, 15),
                udf3: String(seva || "General Seva").slice(0, 50)
            },
            paymentFlow: { 
                type: "PG_CHECKOUT", 
                merchantUrls: { 
                    redirectUrl: redirectUrl 
                } 
            }
        };

        const payResponse = await fetch(payUrl, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `O-Bearer ${accessToken}`,
                "X-MERCHANT-ID": merchantId
            },
            body: JSON.stringify(paymentPayload)
        });

        const payData = await payResponse.json();

        if (payResponse.ok && payData.redirectUrl) {
            return res.status(200).json({ 
                payment_url: payData.redirectUrl,
                orderId: transactionId
            });
        } else {
            console.error("PhonePe Pay Error:", payData);
            return res.status(500).json({ 
                error: payData.message || "PhonePe Pay-link generation failed.",
                details: payData 
            });
        }
    } catch (error) {
        console.error("Handler Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
