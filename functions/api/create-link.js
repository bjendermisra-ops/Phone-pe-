export default async function handler(req, res) {
    const origin = req.headers.origin || '*';
    if (origin !== '*') {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { name, amount, phone, email, seva, pan, address } = req.body;

        if (!name || !amount || !phone) { 
            return res.status(400).json({ error: 'Required fields missing: name, amount, phone' }); 
        }

        // 🔑 Real Production Credentials Confirmed by Nitin Prabhu
        const clientId = "SU2608031047283544010005";
        const clientSecret = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const merchantId = "ISKCONISONLINE";
        const clientVersion = 1;

        // Unique Order ID (TXN + timestamp + random 3-digit)
        const transactionId = "TXN" + Date.now() + Math.floor(100 + Math.random() * 900);
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        if (isNaN(amountInPaise) || amountInPaise < 100) {
            return res.status(400).json({ error: 'Minimum donation amount must be at least ₹1 (100 paise)' });
        }

        let cleanPhone = phone.toString().trim().replace(/\D/g, '');
        if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);

        // Dynamic Domain: Automatically uses mobileapp.iskconbhuvaikuntha.com
        const host = req.headers.host || 'mobileapp.iskconbhuvaikuntha.com';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const redirectUrl = `${protocol}://${host}/receipt.html?orderId=${transactionId}&name=${encodeURIComponent(name)}&amount=${amount}&seva=${encodeURIComponent(seva || 'General Donation')}&phone=${cleanPhone}&pan=${encodeURIComponent(pan || '')}&address=${encodeURIComponent(address || '')}`;

        // ----------------------------------------------------
        // STEP 1: PhonePe Live OAuth Token Generation
        // ----------------------------------------------------
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
        let tokenErrors = [];

        for (const endpoint of tokenEndpoints) {
            try {
                const tokenRes = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: tokenPayload.toString()
                });
                const tokenJson = await tokenRes.json().catch(() => ({}));
                if (tokenRes.ok && tokenJson.access_token) {
                    accessToken = tokenJson.access_token;
                    break;
                } else {
                    tokenErrors.push({ endpoint, status: tokenRes.status, response: tokenJson });
                }
            } catch (err) {
                tokenErrors.push({ endpoint, error: err.message });
            }
        }

        if (!accessToken) {
            console.error("OAuth Token Failed:", tokenErrors);
            return res.status(500).json({ 
                error: "PhonePe OAuth Token Failed. Please check Client ID / Secret.",
                step: "OAUTH_AUTHENTICATION",
                details: tokenErrors 
            });
        }

        // ----------------------------------------------------
        // STEP 2: Initiate Standard V2 PG Checkout
        // ----------------------------------------------------
        const payUrl = "https://api.phonepe.com/apis/pg/checkout/v2/pay";
        const paymentPayload = {
            merchantOrderId: transactionId,
            amount: amountInPaise,
            expireAfter: 1200,
            metaInfo: {
                udf1: String(name).slice(0, 50),
                udf2: String(cleanPhone).slice(0, 15),
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
                "Authorization": `O-Bearer ${accessToken}`,
                "X-MERCHANT-ID": merchantId
            },
            body: JSON.stringify(paymentPayload)
        });

        const payData = await payResponse.json().catch(() => ({}));

        if (payResponse.ok && payData.redirectUrl) {
            return res.status(200).json({ 
                payment_url: payData.redirectUrl,
                orderId: transactionId 
            });
        } else {
            console.error("PhonePe Pay Error:", payData);
            return res.status(500).json({ 
                error: `PhonePe [${payResponse.status}]: ${payData.message || payData.code || "Checkout generation failed"}`,
                step: "PG_CHECKOUT_CREATION",
                details: payData 
            });
        }

    } catch (error) {
        console.error("Handler Error:", error);
        return res.status(500).json({ error: error.message, step: "SERVER_INTERNAL_ERROR" });
    }
}
