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
        const { name, amount, phone, seva } = req.body;

        if (!name || !amount || !phone) { 
            return res.status(400).json({ error: 'Required fields missing: name, amount, phone' }); 
        }

        const saltKey = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const saltIndex = 1;
        const transactionId = "TXN" + Date.now();
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        let cleanPhone = phone.toString().trim().replace(/\D/g, '');
        if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);

        const host = req.headers.host || 'phone-pe-pi.vercel.app';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const redirectUrl = `${protocol}://${host}/receipt.html?orderId=${transactionId}&name=${encodeURIComponent(name)}&amount=${amount}&seva=${encodeURIComponent(seva || 'General Donation')}&phone=${cleanPhone}`;

        // Function to call PhonePe V1 with a given merchantId
        async function callPhonePe(mId) {
            const payload = {
                merchantId: mId,
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

            const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
            const stringToHash = base64Payload + "/pg/v1/pay" + saltKey;
            const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
            const checksum = `${sha256Hash}###${saltIndex}`;

            const response = await fetch("https://api.phonepe.com/apis/hermes/pg/v1/pay", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-VERIFY": checksum,
                    "X-MERCHANT-ID": mId,
                    "accept": "application/json"
                },
                body: JSON.stringify({ request: base64Payload })
            });

            const data = await response.json().catch(() => ({}));
            return { status: response.status, ok: response.ok, data };
        }

        // Try Attempt 1: ISKCONISONLINE
        let result = await callPhonePe("ISKCONISONLINE");

        // Try Attempt 2: SU2608031047283544010005 (if first fails)
        if (!result.ok) {
            const result2 = await callPhonePe("SU2608031047283544010005");
            if (result2.ok) {
                result = result2;
            }
        }

        const paymentUrl = result.data?.data?.instrumentResponse?.redirectInfo?.url;

        if (result.ok && paymentUrl) {
            return res.status(200).json({ 
                payment_url: paymentUrl,
                orderId: transactionId 
            });
        } else {
            console.error("PhonePe V1 Fail:", result);
            // Show exact PhonePe response inside the alert popup
            const exactMsg = result.data?.message || result.data?.code || "Unknown Error";
            return res.status(500).json({ 
                error: `PhonePe [${result.status}]: ${result.data?.code || ''} - ${exactMsg}`,
                raw: result.data 
            });
        }

    } catch (error) {
        console.error("Handler Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
