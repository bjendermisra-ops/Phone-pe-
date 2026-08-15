export default async function handler(req, res) {
    // Dynamic CORS Setup
    const origin = req.headers.origin ? req.headers.origin : '*';
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { phone, transactionId, name, amount } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Phone number missing from request' });
        }

        // ⚠️ PLEASE CHANGE THIS KEY IN DOUBLETICK DASHBOARD AFTER TESTING
        const apiKey = "key_pdepb15p8SLYGrjoHFNX68hl6H8iDi7Mmq8JdzTidYqYFNJ4adCtVfpSoanH0uNIlWfpoIvJdvezN2RdyQPQiTuO6wpRlXDSsNNRut4CXTKTWpSkbNHFhT6g53tNLWBI1NmX6Lqy4TKD7N30xW7ZlV9diDqRnu40BIUX3PU8jW9ckrTAMLqeo8jobTxNpMcYAQLhMbRuZoM5CJ5EoXxxLk8L4XQzXoL229XOAFloUlCJ4Xabstw3tk9qvcte";
        
        // Aapka existing approved OTP template
        const templateName = "app_registration"; 

        // Phone number formatting (+91 add karna zaroori hai DoubleTick ke liye)
        let cleanPhone = phone.trim();
        if (cleanPhone.length === 10) {
            cleanPhone = "+91" + cleanPhone;
        } else if (cleanPhone.startsWith("91")) {
            cleanPhone = "+" + cleanPhone;
        } else if (!cleanPhone.startsWith("+")) {
            cleanPhone = "+" + cleanPhone;
        }

        // Testing ke liye fix OTP bhej rahe hain (Kyunki Transaction ID lambi hoti hai aur reject ho sakti hai)
        const testOTP = "1111"; // Payment hone par WhatsApp par "1111 is your verification code" aayega

        // Standard DoubleTick v1 Template Message API URL
        const doubleTickUrl = "https://public.doubletick.io/v1/messages/template";
        
        const payload = {
            "messages": [
                {
                    "to": cleanPhone,
                    "content": {
                        "templateName": templateName,
                        "language": "en",
                        "templateData": {
                            "body": {
                                "placeholders": [
                                    testOTP // Yahan {{1}} ki jagah 1111 jayega
                                ]
                            }
                        }
                    }
                }
            ]
        };

        const response = await fetch(doubleTickUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`, // DoubleTick requires Bearer token format
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // Agar DoubleTick ne success response diya
        if (response.ok) {
            return res.status(200).json({ 
                status: "success", 
                message: "Test WhatsApp message triggered successfully!", 
                doubletick_response: data 
            });
        } else {
            return res.status(response.status).json({ 
                error: "DoubleTick API rejected the message", 
                details: data 
            });
        }

    } catch (error) {
        console.error("WhatsApp API Error: ", error);
        return res.status(500).json({ error: error.message });
    }
}
