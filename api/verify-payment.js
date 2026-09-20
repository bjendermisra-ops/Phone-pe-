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

        // 🔑 Real PhonePe V2 Production Credentials
        const clientId = "SU2608031047283544010005";
        const clientSecret = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const clientVersion = 1;
        const merchantId = "SU2608031047283544010005";

        const tokenPayload = new URLSearchParams();
        tokenPayload.append("client_id", clientId);
        tokenPayload.append("client_version", clientVersion.toString());
        tokenPayload.append("client_secret", clientSecret);
        tokenPayload.append("grant_type", "client_credentials");

        let accessToken = null;

        // --- STEP 1: OAuth Token via Production Server ---
        try {
            const tokenUrl = "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";
            const tokenResponse = await fetch(tokenUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: tokenPayload.toString()
            });

            const tokenData = await tokenResponse.json();
            if (tokenResponse.status === 200 && tokenData.access_token) {
                accessToken = tokenData.access_token;
            } else {
                console.error("Verify Token Error:", tokenData);
            }
        } catch (err) {
            console.error("Verify Token Fetch Error:", err);
        }

        // Fallback Token URL
        if (!accessToken) {
            try {
                const fallbackTokenUrl = "https://api.phonepe.com/apis/apphub/v1/oauth/token";
                const fallbackResponse = await fetch(fallbackTokenUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: tokenPayload.toString()
                });

                const fallbackData = await fallbackResponse.json();
                if (fallbackResponse.status === 200 && fallbackData.access_token) {
                    accessToken = fallbackData.access_token;
                }
            } catch (fallbackErr) {}
        }

        if (!accessToken) {
            return res.status(500).json({ error: "Failed to generate status check OAuth token." });
        }

        // --- STEP 2: Real Production Status Check API ---
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
