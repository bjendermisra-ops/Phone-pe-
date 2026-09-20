export async function onRequest(context) {
    const { request } = context;

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    try {
        const body = await request.json();
        const { phone, transactionId, name, amount, seva } = body;

        if (!phone) {
            return new Response(JSON.stringify({ error: "Phone number is required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const apiKey = "key_pdepb15p8SLYGrjoHFNX68hl6H8iDi7Mmq8JdzTidYqYFNJ4adCtVfpSoanH0uNIlWfpoIvJdvezN2RdyQPQiTuO6wpRlXDSsNNRut4CXTKTWpSkbNHFhT6g53tNLWBI1NmX6Lqy4TKD7N30xW7ZlV9diDqRnu40BIUX3PU8jW9ckrTAMLqeo8jobTxNpMcYAQLhMbRuZoM5CJ5EoXxxLk8L4XQzXoL229XOAFloUlCJ4Xabstw3tk9qvcte";
        const senderNumber = "919226167380"; 
        const templateName = "donation_receipt_2025_v3"; 

        let cleanPhone = phone.toString().trim().replace(/\D/g, ''); 
        if (cleanPhone.length === 10) { cleanPhone = "91" + cleanPhone; } 
        else if (cleanPhone.startsWith("0")) { cleanPhone = "91" + cleanPhone.substring(1); }

        const url = new URL(request.url);
        const host = url.host;
        const finalPdfUrl = `https://${host}/receipt.html?status=success&name=${encodeURIComponent(name || 'Devotee')}&amount=${amount}&seva=${encodeURIComponent(seva || 'Seva')}&txId=${transactionId}&phone=${phone}`;
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

        const response = await fetch(doubleTickUrl, { 
            method: "POST", 
            headers: { "Authorization": apiKey, "Content-Type": "application/json" }, 
            body: JSON.stringify(payload) 
        });
        
        const data = await response.json();

        if (response.status === 201 || response.status === 200) {
            return new Response(JSON.stringify({ status: "success", pdf_link: finalPdfUrl }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        } else {
            return new Response(JSON.stringify({ error: "DoubleTick failed", details: data }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}
