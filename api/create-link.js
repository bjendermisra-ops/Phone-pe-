import qs from 'querystring';

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

        // Live PhonePe V2 Sandbox (Testing) Credentials
        const clientId = "SU2608031047283544010005";
        const clientSecret = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const clientVersion = 1;
        const transactionId = "TXN" + Date.now();
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        // Success redirect points back to your receipt/index success callback page on Vercel (Includes phone for WhatsApp)
        const redirectUrl = `https://${req.headers.host}/index.html?status=success&name=${encodeURIComponent(name)}&amount=${amount}&seva=${encodeURIComponent(seva)}&phone=${phone}&transactionId=${transactionId}`;

        // STEP 1: Sandbox OAuth Token Generation (No 'identity-manager' inside URL in Sandbox) [5.2.1]
        const tokenUrl = "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";
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
            return res.status(500).json({ 
                error: "Failed to generate PhonePe PG V2 Sandbox OAuth Token. Raw Response: " + JSON.stringify(tokenData) 
            });
        }

        // STEP 2: Create Payment Session using Sandbox Checkout API (No 'pg/' inside URL in Sandbox) [5.1.2, 5.1.3]
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
                "Authorization": "O-Bearer " + accessToken // O-Bearer authorization is required for V2 [5.1.2]
            },
            body: JSON.stringify(paymentPayload)
        });

        const payData = await payResponse.json();

        // PhonePe V2 returns checkout page URL inside redirectUrl [5.2.6]
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
