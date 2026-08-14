export default async function handler(req, res) {
    // Dynamic CORS Setup
    const origin = req.headers.origin ? req.headers.origin : '*';
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, amount, phone, email, seva } = req.body;

        if (!name || !amount || !phone) {
            return res.status(400).json({ error: 'Required fields missing' });
        }

        // Newly provided PhonePe V2 Sandbox (Testing) Credentials
        const clientId = "ISKCONISONLINE_260731175";
        const clientSecret = "YTE4YjFjODItMzQzMi00MDY0LTk5MmYtMWRiMTc5Y2ZhZDMz";
        const clientVersion = 1;
        const transactionId = "TXN" + Date.now();
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        // Success redirect points back to your receipt/index success callback page on Vercel
        const redirectUrl = `https://${req.headers.host}/index.html?status=success&name=${encodeURIComponent(name)}&amount=${amount}&seva=${encodeURIComponent(seva)}&transactionId=${transactionId}`;

        // Standard URLSearchParams for robust url-encoding
        const tokenPayload = new URLSearchParams();
        tokenPayload.append("client_id", clientId);
        tokenPayload.append("client_version", clientVersion.toString());
        tokenPayload.append("client_secret", clientSecret);
        tokenPayload.append("grant_type", "client_credentials");

        let accessToken = null;
        let tokenErrorDebug = null;

        // --- STEP 1: Attempt OAuth Token Generation via pg-sandbox first ---
        try {
            const tokenUrl = "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";
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
                tokenErrorDebug = tokenData;
            }
        } catch (err) {
            tokenErrorDebug = { error: err.message };
        }

        // --- STEP 1.5: If pg-sandbox fails (401), automatically fallback to apphub UAT server ---
        if (!accessToken) {
            try {
                const fallbackTokenUrl = "https://api-preprod.phonepe.com/apis/apphub/v1/oauth/token";
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
                } else {
                    tokenErrorDebug = fallbackData;
                }
            } catch (fallbackErr) {
                tokenErrorDebug = { error: fallbackErr.message };
            }
        }

        if (!accessToken) {
            return res.status(500).json({ 
                error: "Failed to generate PhonePe PG V2 Sandbox OAuth Token on both pg-sandbox and apphub endpoints.",
                debug: tokenErrorDebug 
            });
        }

        // STEP 2: Create Payment Session using Sandbox Checkout API
        const payUrl = "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay";
        const paymentPayload = {
            merchantOrderId: transactionId,
            amount: amountInPaise,
            expireAfter: 1200,
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
                "Authorization": "O-Bearer " + accessToken // O-Bearer authorization is required for V2
            },
            body: JSON.stringify(paymentPayload)
        });

        const payData = await payResponse.json();

        // PhonePe V2 returns checkout page URL inside redirectUrl
        if (payResponse.status === 200 && payData.redirectUrl) {
            return res.status(200).json({ payment_url: payData.redirectUrl });
        } else {
            return res.status(500).json({ 
                error: "PhonePe PG V2 Sandbox Pay-link initiation failed.", 
                debug: payData 
            });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message || 'Server PhonePe V2 link generation failed' });
    }
}
