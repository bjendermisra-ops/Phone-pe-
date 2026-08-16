export default async function handler(req, res) {
    // 1. Dynamic CORS Setup (Security)
    const origin = req.headers.origin ? req.headers.origin : '*';
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { phone, transactionId, name, amount, seva, pdfUrl } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // DoubleTick API Credentials
        const apiKey = "key_pdepb15p8SLYGrjoHFNX68hl6H8iDi7Mmq8JdzTidYqYFNJ4adCtVfpSoanH0uNIlWfpoIvJdvezN2RdyQPQiTuO6wpRlXDSsNNRut4CXTKTWpSkbNHFhT6g53tNLWBI1NmX6Lqy4TKD7N30xW7ZlV9diDqRnu40BIUX3PU8jW9ckrTAMLqeo8jobTxNpMcYAQLhMbRuZoM5CJ5EoXxxLk8L4XQzXoL229XOAFloUlCJ4Xabstw3tk9qvcte";
        const senderNumber = "919226167380"; 
        
        const templateName = "donation_receipt_2025_v3"; 

        // Phone Formatting
        let cleanPhone = phone.toString().trim().replace(/\D/g, ''); 
        if (cleanPhone.length === 10) {
            cleanPhone = "91" + cleanPhone;
        } else if (cleanPhone.startsWith("0")) {
            cleanPhone = "91" + cleanPhone.substring(1);
        }

        // PDF URL (Fallback to dummy PDF for testing)
        const finalPdfUrl = pdfUrl || "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
        const pdfFileName = `ISKCON_Receipt_${transactionId || '1234'}.pdf`;

        const doubleTickUrl = "https://public.doubletick.io/whatsapp/message/template";
        
        // PAYLOAD WITH EXACTLY 3 VARIABLES
        const payload = {
            "messages": [
                {
                    "from": senderNumber,
                    "to": cleanPhone,
                    "content": {
                        "language": "en",
                        "templateName": templateName,
                        "templateData": {
                            "header": {
                                "type": "DOCUMENT",
                                "mediaUrl": finalPdfUrl, 
                                "filename": pdfFileName
                            },
                            "body": {
                                "placeholders": [
                                    name || "Devotee",                // {{1}}
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
            return res.status(200).json({ 
                status: "success", 
                message: "WhatsApp PDF Receipt sent successfully! (3 Variables)", 
                doubletick_response: data 
            });
        } else {
            return res.status(500).json({ 
                error: "DoubleTick failed to send message", 
                details: data 
            });
        }

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
