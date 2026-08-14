import qs from 'querystring';

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
        const payloadData = req.method === 'POST' ? req.body : req.query;
        const { payment_id, phone, name, amount } = payloadData;

        if (!payment_id) {
            return res.status(400).json({ error: 'Transaction ID / UTR is required.' });
        }

        const cleanTxId = payment_id.trim();

        // PhonePe V2 Sandbox Credentials
        const clientId = "ISKCONISONLINE_260731175";
        const clientSecret = "YTE4YjFjODItMzQzMi00MDY0LTk5MmYtMWRiMTc5Y2ZhZDMz";
        const clientVersion = 1;
        const merchantId = "ISKCONISONLINE";

        // STEP 1: Generate OAuth Token (PhonePe)
        const tokenUrl = "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";
        const tokenPayload = qs.stringify({
            client_id: clientId,
            client_version: clientVersion,
            client_secret: clientSecret,
            grant_type: "client_credentials"
        });

        const tokenResponse = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenPayload
        });

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            return res.status(500).json({ error: "Failed to generate status OAuth token." });
        }

        // STEP 2: Call V2 Sandbox Status Check API
        const statusUrl = `https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/${cleanTxId}/status`;
        const response = await fetch(statusUrl, {
            method: "GET",
            headers: {
                "Authorization": "O-Bearer " + accessToken,
                "X-MERCHANT-ID": merchantId,
                "accept": "application/json"
            }
        });

        const data = await response.json();

        // STEP 3: If Payment is Success, Send WhatsApp Receipt
        if (response.status === 200 && (data.state === "COMPLETED" || data.state === "SUCCESS")) {
            
            let whatsappDeliveryStatus = "Not Sent (Missing Phone Number)";
            
            if (phone) {
                try {
                    // Your DoubleTick API Credentials & Keys
                    const DOUBLETICK_KEY = "key_pdepb15p8SLYGrjoHFNX68hl6H8iDi7Mmq8JdzTidYqYFNJ4adCtVfpSoanH0uNIIWfpolvJdvezN2RdyQPQiTuO6wpRlXDSsNNRut4CXTKTWpSkbNHFhT6g53tNLWBl1NmX6Lqy4TKD7N3OxW7ZlV9diDqRnu40BIUX3PU8jW9ckrTAMLqeo8jobTxNpMcYAQLhMbRuZoM5CJ5EoXxxLk8L4XQzXoL229XOAFlUlCJ4Xabstw3tk9qvcte";
                    
                    // Format Number logically (+91 required by WhatsApp standard)
                    let formattedPhone = phone.trim();
                    if (!formattedPhone.startsWith('+')) {
                        formattedPhone = formattedPhone.startsWith('91') ? `+${formattedPhone}` : `+91${formattedPhone}`;
                    }

                    // Send Data to DoubleTick Template
                    const dtPayload = {
                        messages: [
                            {
                                to: formattedPhone,
                                content: {
                                    templateName: "app_registration",
                                    language: "en",
                                    templateData: {
                                        body: {
                                            // Make sure these match the variables in your 'app_registration' template on DoubleTick
                                            placeholders: [name || "Devotee", amount ? amount.toString() : "0"]
                                        }
                                    }
                                }
                            }
                        ]
                    };

                    const dtResponse = await fetch('https://api.doubletick.io/v1/message/template', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${DOUBLETICK_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(dtPayload)
                    });

                    const dtJson = await dtResponse.json();
                    whatsappDeliveryStatus = dtResponse.ok ? "Delivered via DoubleTick" : `Failed DoubleTick: ${JSON.stringify(dtJson)}`;
                    
                } catch (err) {
                    console.error("WhatsApp sending error: ", err);
                    whatsappDeliveryStatus = "Error triggering WhatsApp message";
                }
            }

            return res.status(200).json({ 
                status: 'success', 
                message: 'Transaction successfully verified by PhonePe V2!',
                verified_payment_id: cleanTxId,
                whatsapp_status: whatsappDeliveryStatus,
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
