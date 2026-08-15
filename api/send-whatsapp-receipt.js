export default async function handler(req, res) {
    // 1. Dynamic CORS Setup (Security & Access)
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

    // Only allow POST method
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 2. Get Data from Request Body
        const { phone, transactionId, name, amount, seva, pdfUrl } = req.body;

        if (!phone || !transactionId) {
            return res.status(400).json({ error: 'Phone number and Transaction ID are required' });
        }

        // 3. DoubleTick API Credentials
        // ⚠️ WARNING: Keep this key safe. (Best practice is to use process.env.DOUBLETICK_API_KEY)
        const apiKey = "key_pdepb15p8SLYGrjoHFNX68hl6H8iDi7Mmq8JdzTidYqYFNJ4adCtVfpSoanH0uNIlWfpoIvJdvezN2RdyQPQiTuO6wpRlXDSsNNRut4CXTKTWpSkbNHFhT6g53tNLWBI1NmX6Lqy4TKD7N30xW7ZlV9diDqRnu40BIUX3PU8jW9ckrTAMLqeo8jobTxNpMcYAQLhMbRuZoM5CJ5EoXxxLk8L4XQzXoL229XOAFloUlCJ4Xabstw3tk9qvcte";
        const senderNumber = "919226167380"; 
        
        // Naya Approved Template Name
        const templateName = "donation_receipt_2025_v3"; 

        // 4. Format Phone Number (DoubleTick needs 91XXXXXXXXXX without '+')
        let cleanPhone = phone.toString().trim().replace(/\D/g, ''); 
        if (cleanPhone.length === 10) {
            cleanPhone = "91" + cleanPhone;
        } else if (cleanPhone.startsWith("0")) {
            cleanPhone = "91" + cleanPhone.substring(1);
        }

        // 5. PDF Setup (Agar frontend se PDF link nahi aaya, toh ek default link jayega)
        // Aap yahan apni actual static PDF ka link daal sakte hain baad mein
        const finalPdfUrl = pdfUrl || "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
        const pdfFileName = `ISKCON_Receipt_${transactionId}.pdf`;

        // 6. DoubleTick API URL (Same working URL)
        const doubleTickUrl = "https://public.doubletick.io/whatsapp/message/template";
        
        // 7. EXACT PAYLOAD FOR PDF + TEXT TEMPLATE
        const payload = {
            "messages": [
                {
                    "from": senderNumber,
                    "to": cleanPhone,
                    "content": {
                        "language": "en",
                        "templateName": templateName,
                        "templateData": {
                            // 👇 PDF Header Attachment 👇
                            "header": {
                                "type": "DOCUMENT",
                                "mediaUrl": finalPdfUrl, 
                                "filename": pdfFileName
                            },
                            // 👇 Variables for the Text Body 👇
                            "body": {
                                "placeholders": [
                                    name || "Devotee",           // {{1}}
                                    amount ? amount.toString() : "0", // {{2}}
                                    seva || "General Donation",  // {{3}}
                                    transactionId                // {{4}}
                                ]
                            }
                        }
                    }
                }
            ]
        };

        // 8. Send Request to DoubleTick API
        const response = await fetch(doubleTickUrl, {
            method: "POST",
            headers: {
                "Authorization": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // 9. Return Success/Failure
        if (response.status === 201 || response.status === 200) {
            console.log("✅ WhatsApp PDF Receipt Sent:", data);
            return res.status(200).json({ 
                status: "success", 
                message: "WhatsApp PDF Receipt sent successfully!", 
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
