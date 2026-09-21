import crypto from 'crypto';

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

        // 🔑 Real Production Option 1 (Salt Key & Index)
        const merchantId = "ISKCONISONLINE";
        const saltKey = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const saltIndex = 1;

        const transactionId = "TXN" + Date.now();
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        if (isNaN(amountInPaise) || amountInPaise < 100) {
            return res.status(400).json({ error: 'Minimum amount must be at least ₹1' });
        }

        let cleanPhone = phone.toString().trim().replace(/\D/g, '');
        if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);

        const host = req.headers.host || 'phone-pe-pi.vercel.app';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const redirectUrl = `${protocol}://${host}/receipt.html?orderId=${transactionId}&name=${encodeURIComponent(name)}&amount=${amount}&seva=${encodeURIComponent(seva || 'General Donation')}&phone=${cleanPhone}&pan=${encodeURIComponent(pan || '')}&address=${encodeURIComponent(address || '')}`;

        // 1. PhonePe Option 1 (V1 Standard Payload)
        const payload = {
            merchantId: merchantId,
            merchantTransactionId: transactionId,
            merchantUserId: "MUID" + cleanPhone,
            amount: amountInPaise,
            redirectUrl: redirectUrl,
            redirectMode: "REDIRECT",
            callbackUrl: redirectUrl,
            mobileNumber: cleanPhone,
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        };

        // 2. Base64 Encode & Generate SHA256 Checksum (No OAuth needed!)
        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
        const stringToHash = base64Payload + "/pg/v1/pay" + saltKey;
        const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const checksum = `${sha256Hash}###${saltIndex}`;

        // 3. Official Production Endpoint
        const prodUrl = "https://api.phonepe.com/apis/hermes/pg/v1/pay";

        let response = await fetch(prodUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-VERIFY": checksum,
                "accept": "application/json"
            },
            body: JSON.stringify({ request: base64Payload })
        });

        let data = await response.json();

        // Fallback: Agar Sub-merchant ID (SU...) mapped ho
        if (!response.ok && data.code === "MERCHANT_NOT_FOUND") {
            payload.merchantId = "SU2608031047283544010005";
            const subBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
            const subHash = crypto.createHash('sha256').update(subBase64 + "/pg/v1/pay" + saltKey).digest('hex');
            const subChecksum = `${subHash}###${saltIndex}`;

            response = await fetch(prodUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-VERIFY": subChecksum,
                    "accept": "application/json"
                },
                body: JSON.stringify({ request: subBase64 })
            });
            data = await response.json();
        }

        const paymentUrl = data?.data?.instrumentResponse?.redirectInfo?.url;

        if (response.ok && paymentUrl) {
            return res.status(200).json({ 
                payment_url: paymentUrl,
                orderId: transactionId
            });
        } else {
            console.error("PhonePe V1 Error:", data);
            return res.status(500).json({ 
                error: data.message || "Payment initiation failed", 
                details: data 
            });
        }

    } catch (error) {
        console.error("Handler Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
