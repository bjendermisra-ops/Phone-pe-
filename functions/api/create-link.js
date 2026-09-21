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

        // 🔑 Live Approved Paylink Credentials
        const clientId = process.env.PHONEPE_CLIENT_ID || "SU2608031047283544010005";
        const clientSecret = process.env.PHONEPE_CLIENT_SECRET || "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const clientVersion = 1;

        const transactionId = "TXN" + Date.now();
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        if (isNaN(amountInPaise) || amountInPaise < 100) {
            return res.status(400).json({ error: 'Minimum amount must be at least ₹1' });
        }

        // Clean Indian Mobile Number with Country Code (+91)
        let rawPhone = phone.toString().trim().replace(/\D/g, '');
        if (rawPhone.length === 10) rawPhone = "91" + rawPhone;
        else if (rawPhone.startsWith("0")) rawPhone = "91" + rawPhone.substring(1);
        const formattedPhone = "+" + rawPhone;

        const host = req.headers.host || 'phone-pe-pi.vercel.app';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const redirectUrl = `${protocol}://${host}/receipt.html?orderId=${transactionId}&name=${encodeURIComponent(name)}&amount=${amount}&seva=${encodeURIComponent(seva || 'General Donation')}&phone=${phone}&pan=${encodeURIComponent(pan || '')}&address=${encodeURIComponent(address || '')}`;

        // 1. Generate Live OAuth Token
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
            return res.status(500).json({ error: "Failed to generate PhonePe PG OAuth Token." });
        }

        // 2. Official PhonePe Paylinks API (The exact service active on your account)
        const payUrl = "https://api.phonepe.com/apis/pg/paylinks/v1/pay";
        const paymentPayload = {
            merchantOrderId: transactionId,
            description: `Seva Donation for ${seva || 'ISKCON Bhuvaikuntha'}`.slice(0, 50),
            amount: amountInPaise,
            paymentFlow: {
                type: "PAYLINK",
                customerDetails: {
                    name: String(name).slice(0, 50),
                    phoneNumber: formattedPhone
                },
                notificationChannels: {
                    SMS: false,
                    EMAIL: false
                },
                merchantUrls: {
                    redirectUrl: redirectUrl
                }
            },
            metaInfo: {
                udf1: String(name).slice(0, 50),
                udf2: String(phone).slice(0, 15),
                udf3: String(seva || "General Seva").slice(0, 50)
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

        // Paylink returns paylinkUrl or redirectUrl
        const finalUrl = payData.paylinkUrl || payData.redirectUrl;

        if (payResponse.ok && finalUrl) {
            return res.status(200).json({ 
                payment_url: finalUrl,
                orderId: transactionId,
                phonepeOrderId: payData.orderId
            });
        } else {
            console.error("PhonePe Paylink Error:", payData);
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
