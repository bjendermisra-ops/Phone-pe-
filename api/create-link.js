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
        const { name, amount, phone, email, seva, pan, address, returnUrl } = req.body;

        if (!name || !amount || !phone) { 
            return res.status(400).json({ error: 'Required fields missing: name, amount, phone' }); 
        }

        // 🔑 Real Production Credentials
        const clientId = process.env.PHONEPE_CLIENT_ID || "SU2608031047283544010005";
        const clientSecret = process.env.PHONEPE_CLIENT_SECRET || "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const merchantId = process.env.PHONEPE_MERCHANT_ID || "ISKCONISONLINE";
        const clientVersion = 1;

        // Transaction ID (Unique & Clean alphanumeric)
        const transactionId = "TXN" + Date.now() + Math.floor(1000 + Math.random() * 9000);
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        if (isNaN(amountInPaise) || amountInPaise <= 0) {
            return res.status(400).json({ error: 'Invalid amount.' });
        }

        const host = req.headers.host || 'phone-pe-pi.vercel.app';
        const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
        const encodedReturn = returnUrl ? encodeURIComponent(returnUrl) : encodeURIComponent(`${protocol}://${host}/index.html`);
        
        // IMPORTANT: We do NOT pass status=success here. Verification script checks real status.
        const redirectUrl = `${protocol}://${host}/receipt.html?orderId=${transactionId}&name=${encodeURIComponent(name)}&amount=${amount}&seva=${encodeURIComponent(seva || 'Seva Donation')}&phone=${phone}&pan=${encodeURIComponent(pan || '')}&address=${encodeURIComponent(address || '')}&returnUrl=${encodedReturn}`;

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
            return res.status(500).json({ error: "Failed to generate PhonePe Live OAuth Token. Check credentials or network." });
        }

        // 2. Create Live Checkout Pay Link (Production V2)
        const payUrl = "https://api.phonepe.com/apis/pg/checkout/v2/pay";
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
