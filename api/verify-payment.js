import crypto from 'crypto';

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

        // PhonePe V1 Live Production Credentials
        const merchantId = "ISKCONISONLINE";
        const saltKey = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const saltIndex = "1";

        // PhonePe V1 Status Check API endpoint
        const statusCheckUrl = `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${cleanTxId}`;

        // Calculate V1 Status Check X-VERIFY signature
        const signatureInput = `/pg/v1/status/${merchantId}/${cleanTxId}` + saltKey;
        const sha256Hash = crypto.createHash('sha256').update(signatureInput).digest('hex');
        const xVerify = sha256Hash + "###" + saltIndex;

        const response = await fetch(statusCheckUrl, {
            method: "GET",
            headers: {
                "X-VERIFY": xVerify,
                "X-MERCHANT-ID": merchantId,
                "accept": "application/json"
            }
        });

        const data = await response.json();

        // PhonePe V1 returns PAYMENT_SUCCESS on completed transactions
        if (data.success && data.code === "PAYMENT_SUCCESS") {
            return res.status(200).json({ 
                status: 'success', 
                message: 'Transaction successfully verified by PhonePe V1!',
                verified_payment_id: cleanTxId,
                payment_details: {
                    contact: 'UPI',
                    method: 'PHONEPE V1'
                }
            });
        } else {
            return res.status(400).json({ 
                error: data.message || 'Transaction verification failed.' 
            });
        }

    } catch (error) {
        console.error("Verification server error: ", error);
        return res.status(500).json({ error: 'Server PhonePe V1 status verification failed.' });
    }
}
