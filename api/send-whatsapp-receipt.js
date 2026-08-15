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
        const { phone, name, amount, seva, transactionId } = req.body;

        if (!phone || !name || !amount || !transactionId) {
            return res.status(400).json({ error: 'Required parameters missing' });
        }

        // WhatsApp standard properties
        const apiKey = "key_pdepb15p8SLYGrjoHFNX68hl6H8iDi7Mmq8JdzTidYqYFNJ4adCtVfpSoanH0uNIlWfpoIvJdvezN2RdyQPQiTuO6wpRlXDSsNNRut4CXTKTWpSkbNHFhT6g53tNLWBI1NmX6Lqy4TKD7N30xW7ZlV9diDqRnu40BIUX3PU8jW9ckrTAMLqeo8jobTxNpMcYAQLhMbRuZoM5CJ5EoXxxLk8L4XQzXoL229XOAFloUlCJ4Xabstw3tk9qvcte";
        const senderNumber = "919226167380";
        const templateName = "app_registration"; // Approved template bypass method [1.1.2]

        // Beautiful formatted receipt pushed directly into the single template placeholder [1.1.2, 1.1.6]
        const receiptMessage = `*Hare Krishna!* 🙏\n\nDear *${name}*,\nThank you for your generous contribution of *₹${amount}/-* towards *${seva}* at ISKCON Bhuvaikuntha.\n\n*Transaction Details*:\n• *Tx ID:* ${transactionId}\n• *Date:* ${new Date().toLocaleDateString('en-IN')}\n\nMay the Deities bless you! 🌸`;

        const cleanPhone = phone.trim().startsWith("91") ? phone.trim() : "91" + phone.trim();

        const doubleTickUrl = "https://public.doubletick.io/whatsapp/message/template";
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
                                    receiptMessage // dynamic receipt message [1.1.6]
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
                "Authorization": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.status === 201 || response.status === 200) {
            return res.status(200).json({ status: "success", message: "WhatsApp receipt sent successfully!" });
        } else {
            return res.status(500).json({ error: "DoubleTick failed: " + JSON.stringify(data) });
        }

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
