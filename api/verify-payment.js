export default async function handler(req, res) {
    const origin = req.headers.origin || '*';
    if (origin !== '*') {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const payment_id = (req.method === 'POST' ? req.body?.payment_id || req.body?.orderId : req.query?.payment_id || req.query?.orderId);

        if (!payment_id) {
            return res.status(400).json({ error: 'Order/Transaction ID is required.' });
        }

        const cleanTxId = payment_id.toString().trim();

        // 🔑 Live Production Credentials
        const clientId = process.env.PHONEPE_CLIENT_ID || "SU2608031047283544010005";
        const clientSecret = process.env.PHONEPE_CLIENT_SECRET || "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const merchantId = process.env.PHONEPE_MERCHANT_ID || "ISKCONISONLINE";
        const clientVersion = 1;

        // Step 1: Generate OAuth Token for Status API
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
            return res.status(500).json({ error: "Failed to generate PhonePe Status OAuth token." });
        }

        // Step 2: Call Real PhonePe Live Status API
        const statusUrl = `https://api.phonepe.com/apis/pg/checkout/v2/order/${cleanTxId}/status?details=false&errorContext=true`;

        const response = await fetch(statusUrl, {
            method: "GET",
            headers: {
                "Authorization": `O-Bearer ${accessToken}`,
                "X-MERCHANT-ID": merchantId,
                "Accept": "application/json"
            }
        });

        const data = await response.json();

        // PhonePe returns COMPLETED when real payment succeeded
        if (response.ok && (data.state === "COMPLETED" || data.state === "SUCCESS")) {
            return res.status(200).json({ 
                status: 'success', 
                verified: true,
                message: 'Transaction successfully verified with PhonePe Production!',
                orderId: cleanTxId,
                amount: data.amount ? data.amount / 100 : undefined,
                state: data.state
            });
        } else {
            return res.status(400).json({ 
                status: 'failed',
                verified: false,
                state: data.state || 'FAILED',
                message: data.message || `Payment status is ${data.state || 'UNPAID'}` 
            });
        }

    } catch (error) {
        console.error("Verification server error: ", error);
        return res.status(500).json({ error: error.message });
    }
}
