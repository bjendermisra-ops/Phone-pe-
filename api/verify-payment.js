import qs from 'querystring';

export default async function handler(req, res) {
    // Dynamic CORS Setup
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
        const { payment_id } = req.method === 'POST' ? req.body : req.query;

        if (!payment_id) {
            return res.status(400).json({ error: 'Transaction ID / UTR is required.' });
        }

        const cleanTxId = payment_id.trim();

        // PhonePe V2 Production Credentials
        const clientId = "SU2608031047283544010005";
        const clientSecret = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const clientVersion = 1;
        const merchantId = "ISKCONISONLINE";

        // STEP 1: Generate OAuth Token (Production URL)
        const tokenUrl = "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";
        const tokenPayload = qs.stringify({
            client_id: clientId,
            client_version: clientVersion,
            client_secret: clientSecret,
            grant_type: "client_credentials"
        });

        const tokenResponse = await fetch(tokenUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: tokenPayload
        });

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            return res.status(500).json({ error: "Failed to generate status OAuth token." });
        }

        // STEP 2: Call V2 Production Status Check API securely
        const statusUrl = `https://api.phonepe.com/apis/pg/checkout/v2/order/${cleanTxId}/status`;

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
            return res.status(200).json({ 
                status: 'success', 
                message: 'Transaction successfully verified by PhonePe V2!',
                verified_payment_id: cleanTxId,
                payment_details: {
                    contact: 'UPI',
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
