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

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { name, amount, phone, seva } = req.body || {};

        if (!name || !amount || !phone) {
            return res.status(400).json({ error: 'Required fields missing: name, amount, phone' });
        }

        // TESTING KEYS (baad mein Vercel Environment Variables mein shift karna)
        const clientId = "SU2608031047283544010005";
        const clientSecret = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const clientVersion = 1;

        const transactionId = "TXN" + Date.now();
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        let cleanPhone = phone.toString().trim().replace(/\D/g, '');
        if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);

        const host = req.headers.host || 'mobileapp.iskconbhuvaikuntha.com';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const redirectUrl = `${protocol}://${host}/receipt.html?orderId=${transactionId}&name=${encodeURIComponent(name)}&amount=${amount}&seva=${encodeURIComponent(seva || 'General Donation')}&phone=${cleanPhone}`;

        // 1. Token
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

        const tokenJson = await tokenRes.json().catch(() => ({}));
        const accessToken = tokenJson.access_token;

        if (!accessToken) {
            console.log("TOKEN_ERR", tokenRes.status, JSON.stringify(tokenJson));
            return res.status(500).json({ error: "Token generation failed", details: tokenJson });
        }

        // 2. Pay
        const payUrl = "https://api.phonepe.com/apis/pg/checkout/v2/pay";
        const paymentPayload = {
            merchantOrderId: transactionId,
            amount: amountInPaise,
            expireAfter: 1200,
            metaInfo: {
                udf1: String(name).slice(0, 50),
                udf2: String(cleanPhone).slice(0, 15),
                udf3: "com.harekrsna15.Bhu"
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

        const payData = await payResponse.json().catch(() => ({}));

        if (payResponse.ok && payData.redirectUrl) {
            console.log("PAYMENT_LINK", payData.redirectUrl);
            console.log("REDIRECT_SENT_TO_PHONEPE", redirectUrl);
            return res.status(200).json({
                payment_url: payData.redirectUrl,
                orderId: transactionId,
                debug: { sentRedirectUrl: redirectUrl }
            });
        } else {
            console.log("PHONEPE_ERR", payResponse.status, JSON.stringify(payData));
            return res.status(500).json({
                error: payData.message || "Failed to create payment session",
                details: payData
            });
        }

    } catch (error) {
        console.log("CATCH_ERR", error.message);
        return res.status(500).json({ error: error.message });
    }
}
