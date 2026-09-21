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
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { name, amount, phone, seva } = req.body;

        if (!name || !amount || !phone) { 
            return res.status(400).json({ error: 'Required fields missing: name, amount, phone' }); 
        }

        const clientId = "SU2608031047283544010005";
        const clientSecret = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const merchantId = "ISKCONISONLINE";
        const clientVersion = 1;

        const transactionId = "TXN" + Date.now();
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        if (isNaN(amountInPaise) || amountInPaise < 100) {
            return res.status(400).json({ error: 'Minimum amount must be at least ₹1' });
        }

        const host = req.headers.host || 'phone-pe-pi.vercel.app';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const redirectUrl = `${protocol}://${host}/receipt.html?orderId=${transactionId}`;

        // 1. Get Live OAuth Token
        const tokenPayload = new URLSearchParams({
            client_id: clientId,
            client_version: clientVersion.toString(),
            client_secret: clientSecret,
            grant_type: "client_credentials"
        });

        let accessToken = null;
        try {
            const tokenRes = await fetch("https://api.phonepe.com/apis/identity-manager/v1/oauth/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: tokenPayload.toString()
            });
            const tokenJson = await tokenRes.json();
            if (tokenRes.ok && tokenJson.access_token) {
                accessToken = tokenJson.access_token;
            }
        } catch (e) {}

        if (!accessToken) {
            try {
                const tokenRes2 = await fetch("https://api.phonepe.com/apis/pg/v1/oauth/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenPayload.toString()
                });
                const tokenJson2 = await tokenRes2.json();
                if (tokenRes2.ok && tokenJson2.access_token) {
                    accessToken = tokenJson2.access_token;
                }
            } catch (e) {}
        }

        if (!accessToken) {
            return res.status(500).json({ error: "Failed to authenticate with PhonePe." });
        }

        // 2. Standard V2 PG Checkout (The only working endpoint for this client ID)
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
                message: "ISKCON Seva Donation",
                merchantUrls: { 
                    redirectUrl: redirectUrl 
                } 
            }
        };

        const payResponse = await fetch(payUrl, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `O-Bearer ${accessToken}`
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
            return res.status(500).json({ 
                error: payData.message || "Failed to create checkout",
                details: payData 
            });
        }

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
