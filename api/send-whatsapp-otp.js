export default async function handler(req, res) {
    // CORS Setup
    const origin = req.headers.origin ? req.headers.origin : '*';
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ error: 'Phone and OTP are required' });
        }

        // DoubleTick Credentials
        const apiKey = "key_pdepb15p8SLYGrjoHFNX68hl6H8iDi7Mmq8JdzTidYqYFNJ4adCtVfpSoanH0uNIlWfpoIvJdvezN2RdyQPQiTuO6wpRlXDSsNNRut4CXTKTWpSkbNHFhT6g53tNLWBI1NmX6Lqy4TKD7N30xW7ZlV9diDqRnu40BIUX3PU8jW9ckrTAMLqeo8jobTxNpMcYAQLhMbRuZoM5CJ5EoXxxLk8L4XQzXoL229XOAFloUlCJ4Xabstw3tk9qvcte";
        const senderNumber = "919226167380"; 
        
        // ⚠️ IMPORTANT: Yahan apne DoubleTick ka OTP template name daalna
        // Example: "login_otp" jisme 1 variable ho {{1}}
        const templateName = "app_registration"; // Abhi ke liye yahi hai, par DoubleTick me OTP ka template approve kara lena.

        const doubleTickUrl = "https://public.doubletick.io/whatsapp/message/template";
        
        const payload = {
            "messages": [
                {
                    "from": senderNumber,
                    "to": phone,
                    "content": {
                        "language": "en",
                        "templateName": templateName,
                        "templateData": {
                            "body": {
                                "placeholders": [ otp ] // OTP code jayega variable me
                            }
                        }
                    }
                }
            ]
        };

        const response = await fetch(doubleTickUrl, {
            method: "POST",
            headers: { "Authorization": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.status === 201 || response.status === 200) {
            return res.status(200).json({ status: "success", message: "OTP Sent!" });
        } else {
            return res.status(500).json({ error: "DoubleTick failed", details: data });
        }

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
