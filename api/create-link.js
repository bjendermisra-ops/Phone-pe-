import crypto from 'crypto';

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

        // Live PhonePe V1 Production Credentials (Hermes)
        const merchantId = "ISKCONISONLINE";
        const saltKey = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const saltIndex = "1";
        const transactionId = "TXN" + Date.now();
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        // Redirects directly back to your Vercel index.html upon successful live payment
        const redirectUrl = `https://${req.headers.host}/index.html?status=success&name=${encodeURIComponent(name)}&amount=${amount}&seva=${encodeURIComponent(seva)}&transactionId=${transactionId}`;

        const requestPayload = {
            merchantId: merchantId,
            merchantTransactionId: transactionId,
            merchantUserId: "USER_" + phone,
            amount: amountInPaise,
            redirectUrl: redirectUrl,
            redirectMode: "POST", // Strictly POST/GET as per PhonePe V1 specs
            callbackUrl: redirectUrl, 
            mobileNumber: phone,
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        };

        const base64Payload = Buffer.from(JSON.stringify(requestPayload)).toString('base64');
        const signatureInput = base64Payload + "/pg/v1/pay" + saltKey;
        const sha256Hash = crypto.createHash('sha256').update(signatureInput).digest('hex');
        const xVerify = sha256Hash + "###" + saltIndex;

        const phonePeUrl = "https://api.phonepe.com/apis/hermes/pg/v1/pay"; // Real Live Production API Endpoint

        const response = await fetch(phonePeUrl, {
            method: "POST",
            headers: {
                "X-VERIFY": xVerify,
                "Content-Type": "application/json",
                "accept": "application/json"
            },
            body: JSON.stringify({ request: base64Payload })
        });

        const data = await response.json();

        if (data.success && data.data && data.data.instrumentResponse) {
            const payUrl = data.data.instrumentResponse.redirectInfo.url;
            return res.status(200).json({ payment_url: payUrl });
        } else {
            return res.status(500).json({ error: data.message || "PhonePe API failed to generate Pay-link." });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message || 'Server PhonePe V1 link generation failed' });
    }
}
