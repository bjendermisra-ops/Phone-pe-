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
            return res.status(400).json({ error: 'Order ID is required.' });
        }

        const cleanTxId = payment_id.toString().trim();
        const clientId = "SU2608031047283544010005";
        const clientSecret = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const merchantId = "ISKCONISONLINE";
        const clientVersion = 1;

        // 1. Get Status Token
        const tokenPayload = new URLSearchParams({
            client_id: clientId,
            client_version: clientVersion.toString(),
            client_secret: clientSecret,
            grant_type: "client_credentials"
        });

        const tokenRes = await fetch("https://api.phonepe.com/apis/identity-manager/v1/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenPayload.toString()
        });

        const tokenData = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !tokenData.access_token) {
            return res.status(500).json({ error: "Failed to authenticate status checker." });
        }

        // 2. Fetch Full Diagnostic Details (?details=true&errorContext=true)
        const statusUrl = `https://api.phonepe.com/apis/pg/checkout/v2/order/${cleanTxId}/status?details=true&errorContext=true`;

        const response = await fetch(statusUrl, {
            method: "GET",
            headers: {
                "Authorization": `O-Bearer ${tokenData.access_token}`,
                "X-MERCHANT-ID": merchantId,
                "Accept": "application/json"
            }
        });

        const data = await response.json().catch(() => ({}));

        return res.status(200).json({
            httpStatus: response.status,
            state: data.state || 'UNKNOWN',
            responseCode: data.responseCode || data.code,
            errorContext: data.errorContext || null,
            paymentDetails: data.paymentDetails || null,
            rawData: data
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
