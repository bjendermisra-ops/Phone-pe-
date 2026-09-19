export async function onRequest(context) {
    const { request } = context;

    // 🌐 Cloudflare CORS Headers
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle Browser Preflight
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
        // 📥 Cloudflare JSON Body Reader
        const body = await request.json();
        const { phone, otp } = body;

        if (!phone || !otp) {
            return new Response(JSON.stringify({ error: "Phone and OTP are required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 🇮🇳 Ensure Country Code 91 for DoubleTick
        let rawDigits = phone.toString().trim().replace(/\D/g, '');
        let cleanPhone = rawDigits;
        if (rawDigits.length === 10) {
            cleanPhone = "91" + rawDigits;
        } else if (rawDigits.startsWith("0")) {
            cleanPhone = "91" + rawDigits.substring(1);
        }

        const apiKey = "key_pdepb15p8SLYGrjoHFNX68hl6H8iDi7Mmq8JdzTidYqYFNJ4adCtVfpSoanH0uNIlWfpoIvJdvezN2RdyQPQiTuO6wpRlXDSsNNRut4CXTKTWpSkbNHFhT6g53tNLWBI1NmX6Lqy4TKD7N30xW7ZlV9diDqRnu40BIUX3PU8jW9ckrTAMLqeo8jobTxNpMcYAQLhMbRuZoM5CJ5EoXxxLk8L4XQzXoL229XOAFloUlCJ4Xabstw3tk9qvcte";
        const senderNumber = "919226167380"; 
        const templateName = "app_registration"; 
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
                                "placeholders": [ String(otp) ]
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
            // 📤 Cloudflare Response Format
            return new Response(JSON.stringify({ status: "success", message: "OTP Sent!" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        } else {
            console.error("DoubleTick Error:", data);
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
