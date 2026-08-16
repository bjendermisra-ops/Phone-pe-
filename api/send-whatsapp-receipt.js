export default async function handler(req, res) {
    const origin = req.headers.origin ? req.headers.origin : '*';
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

    try {
        // Receive new fields
        const { phone, transactionId, name, amount, seva, pan, address } = req.body;
        if (!phone) { return res.status(400).json({ error: 'Phone number is required' }); }

        const apiKey = "key_pdepb15p8SLYGrjoHFNX68hl6H8iDi7Mmq8JdzTidYqYFNJ4adCtVfpSoanH0uNIlWfpoIvJdvezN2RdyQPQiTuO6wpRlXDSsNNRut4CXTKTWpSkbNHFhT6g53tNLWBI1NmX6Lqy4TKD7N30xW7ZlV9diDqRnu40BIUX3PU8jW9ckrTAMLqeo8jobTxNpMcYAQLhMbRuZoM5CJ5EoXxxLk8L4XQzXoL229XOAFloUlCJ4Xabstw3tk9qvcte";
        const senderNumber = "919226167380"; 
        const templateName = "donation_receipt_2025_v3"; 

        let cleanPhone = phone.toString().trim().replace(/\D/g, ''); 
        if (cleanPhone.length === 10) { cleanPhone = "91" + cleanPhone; } 
        else if (cleanPhone.startsWith("0")) { cleanPhone = "91" + cleanPhone.substring(1); }

        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        
        // Dynamic link me PAN aur Address add kar diya
        const finalPdfUrl = `${protocol}://${host}/api/generate-pdf?name=${encodeURIComponent(name)}&amount=${amount}&seva=${encodeURIComponent(seva)}&txId=${transactionId}&phone=${phone}&date=${Date.now()}&pan=${encodeURIComponent(pan || '')}&address=${encodeURIComponent(address || '')}`;
        const pdfFileName = `ISKCON_Receipt_${transactionId || '1234'}.pdf`;

        const doubleTickUrl = "https://public.doubletick.io/whatsapp/message/template";
        const payload = {
            "messages": [{
                "from": senderNumber, "to": cleanPhone,
                "content": {
                    "language": "en", "templateName": templateName,
                    "templateData": {
                        "header": { "type": "DOCUMENT", "mediaUrl": finalPdfUrl, "filename": pdfFileName },
                        "body": { "placeholders": [ name || "Devotee" ] }
                    }
                }
            }]
        };

        const response = await fetch(doubleTickUrl, { method: "POST", headers: { "Authorization": apiKey, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await response.json();

        if (response.status === 201 || response.status === 200) {
            return res.status(200).json({ status: "success", pdf_link: finalPdfUrl });
        } else {
            return res.status(500).json({ error: "DoubleTick failed", details: data });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
