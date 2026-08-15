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
            return res.status(400).json({ error: 'Phone parameter missing' });
        }

        // Aapki Keys aur Sender ID
        const apiKey = "key_pdepb15p8SLYGrjoHFNX68hl6H8iDi7Mmq8JdzTidYqYFNJ4adCtVfpSoanH0uNIlWfpoIvJdvezN2RdyQPQiTuO6wpRlXDSsNNRut4CXTKTWpSkbNHFhT6g53tNLWBI1NmX6Lqy4TKD7N30xW7ZlV9diDqRnu40BIUX3PU8jW9ckrTAMLqeo8jobTxNpMcYAQLhMbRuZoM5CJ5EoXxxLk8L4XQzXoL229XOAFloUlCJ4Xabstw3tk9qvcte";
        const senderNumber = "919226167380";
        const templateName = "app_registration"; // Apka OTP template

        // Phone format exactly as required by Doubletick (91XXXXXXXXXX) without '+'
        let cleanPhone = phone.trim().replace(/\D/g, ''); 
        if (cleanPhone.length === 10) {
            cleanPhone = "91" + cleanPhone;
        } else if (cleanPhone.startsWith("0")) {
            cleanPhone = "91" + cleanPhone.substring(1);
        }

        // Wahi same URL jo aapne pehle mujhe di thi
        const doubleTickUrl = "https://public.doubletick.io/whatsapp/message/template";
        
        // Exact working payload
        const payload = {
            "messages": [
                {
                    "from": senderNumber,
                    "to": cleanPhone,
                    "content": {
                        "language": "en",
                        "templateName": templateName,
                        "templateData": {
                            "body": {
                                "placeholders": [
                                    "1111" // Hardcoded Testing OTP to avoid template rejection
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
                "Authorization": apiKey, // Bina 'Bearer' ke (Aapke original code jaisa)
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // 201 Created ya 200 OK dono chalenge
        if (response.status === 201 || response.status === 200) {
            console.log("✅ WhatsApp Success:", data);
            return res.status(200).json({ 
                status: "success", 
                message: "WhatsApp triggered successfully", 
                doubletick_response: data 
            });
        } else {
            console.error("❌ DoubleTick Error:", data);
            return res.status(500).json({ 
                error: "DoubleTick failed to send message", 
                details: data 
            });
        }

    } catch (error) {
        console.error("❌ Server Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
