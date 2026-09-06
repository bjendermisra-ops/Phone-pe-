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
        const { phone, otp, name } = body;

        if (!phone || !otp) {
            return new Response(JSON.stringify({ error: "Phone and OTP are required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 🇮🇳 Clean phone number format (Same as working receipt.js)
        let cleanPhone = phone.toString().trim().replace(/\D/g, '');
        if (cleanPhone.length === 10) {
            cleanPhone = "91" + cleanPhone;
        } else if (cleanPhone.startsWith("0")) {
            cleanPhone = "91" + cleanPhone.substring(1);
        }

        const apiKey = "key_pdepb15p8SLYGrjoHFNX68hl6H8iDi7Mmq8JdzTidYqYFNJ4adCtVfpSoanH0uNIlWfpoIvJdvezN2RdyQPQiTuO6wpRlXDSsNNRut4CXTKTWpSkbNHFhT6g53tNLWBI1NmX6Lqy4TKD7N30xW7ZlV9diDqRnu40BIUX3PU8jW9ckrTAMLqeo8jobTxNpMcYAQLhMbRuZoM5CJ5EoXxxLk8L4XQzXoL229XOAFloUlCJ4Xabstw3tk9qvcte";
        const senderNumber = "919226167380"; 
        const templateName = "app_registration"; 
        const doubleTickUrl = "https://public.doubletick.io/whatsapp/message/template";
        
        // 🚀 Primary Payload (Standard Body Placeholder)
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
                            },
                            "buttons": [
                                {
                                    "type": "URL",
                                    "parameter": String(otp)
                                }
                            ]
                        }
                    }
                }
            ]
        };

        let response = await fetch(doubleTickUrl, {
            method: "POST",
            headers: { 
                "Authorization": apiKey, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify(payload)
        });

        let data = await response.json();

        // 🔄 Fallback 1: If Button format failed, try plain body without buttons
        if (response.status !== 200 && response.status !== 201) {
            const fallbackPayload = {
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

            const fallbackRes = await fetch(doubleTickUrl, {
                method: "POST",
                headers: { "Authorization": apiKey, "Content-Type": "application/json" },
                body: JSON.stringify(fallbackPayload)
            });

            const fallbackData = await fallbackRes.json();
            if (fallbackRes.status === 200 || fallbackRes.status === 201) {
                return new Response(JSON.stringify({ status: "success", message: "OTP Sent Successfully!" }), {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
        }

        if (response.status === 201 || response.status === 200) {
            return new Response(JSON.stringify({ status: "success", message: "OTP Sent Successfully!" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        } else {
            console.error("DoubleTick OTP Error:", data);
            return new Response(JSON.stringify({ status: "error", error: "DoubleTick failed", details: data }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

    } catch (error) {
        return new Response(JSON.stringify({ status: "error", error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}
