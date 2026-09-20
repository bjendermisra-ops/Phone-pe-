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
        const { name, amount, phone, email, seva, pan, address, returnUrl } = body;

        if (!name || !amount || !phone) { 
            return new Response(JSON.stringify({ error: "Required fields missing: name, amount, phone" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 🔑 Real PhonePe Live Credentials
        const clientId = "SU2608031047283544010005";
        const clientSecret = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const clientVersion = 1;

        const transactionId = "TXN" + Date.now();
        const amountInPaise = Math.round(parseFloat(amount) * 100);

        const url = new URL(request.url);
        const host = url.host;
        const encodedReturn = returnUrl ? encodeURIComponent(returnUrl) : encodeURIComponent(`https://${host}/index.html`);
        
        const redirectUrl = `https://${host}/receipt.html?status=success&name=${encodeURIComponent(name)}&amount=${amount}&seva=${encodeURIComponent(seva || 'Seva Donation')}&phone=${phone}&transactionId=${transactionId}&pan=${encodeURIComponent(pan || '')}&address=${encodeURIComponent(address || '')}&returnUrl=${encodedReturn}`;

        // 1. Generate Real Production OAuth Token
        const tokenPayload = new URLSearchParams();
        tokenPayload.append("client_id", clientId);
        tokenPayload.append("client_version", clientVersion.toString());
        tokenPayload.append("client_secret", clientSecret);
        tokenPayload.append("grant_type", "client_credentials");

        let accessToken = null;
        
        // Production Token URL
        const tokenUrl = "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";

        try {
            const tokenResponse = await fetch(tokenUrl, { 
                method: "POST", 
                headers: { "Content-Type": "application/x-www-form-urlencoded" }, 
                body: tokenPayload.toString() 
            });
            const tokenData = await tokenResponse.json();
            if (tokenResponse.status === 200 && tokenData.access_token) { 
                accessToken = tokenData.access_token; 
            } else {
                console.error("Token Error:", tokenData);
            }
        } catch (err) {
            console.error("Token Fetch Error:", err);
        }

        // Fallback Token URL (sirf agar pehla fail ho)
        if (!accessToken) {
            try {
                const fallbackTokenUrl = "https://api.phonepe.com/apis/apphub/v1/oauth/token";
                const fallbackResponse = await fetch(fallbackTokenUrl, { 
                    method: "POST", 
                    headers: { "Content-Type": "application/x-www-form-urlencoded" }, 
                    body: tokenPayload.toString() 
                });
                const fallbackData = await fallbackResponse.json();
                if (fallbackResponse.status === 200 && fallbackData.access_token) { 
                    accessToken = fallbackData.access_token; 
                }
            } catch (fallbackErr) {}
        }

        if (!accessToken) { 
            return new Response(JSON.stringify({ error: "Failed to generate PhonePe PG OAuth Token." }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 2. Real Production Pay URL
        const payUrl = "https://api.phonepe.com/apis/pg/checkout/v2/pay";
        const paymentPayload = {
            merchantOrderId: transactionId,
            amount: amountInPaise,
            expireAfter: 1200,
            metaData: {
                donorName: name,
                donorPhone: phone,
                sevaType: seva || "General Seva"
            },
            paymentFlow: { 
                type: "PG_CHECKOUT", 
                message: `Seva Donation for ${seva || 'ISKCON Bhuvaikuntha'}`,
                merchantUrls: { 
                    redirectUrl: redirectUrl 
                } 
            }
        };

        const payResponse = await fetch(payUrl, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": "O-Bearer " + accessToken 
            },
            body: JSON.stringify(paymentPayload)
        });

        const payData = await payResponse.json();
        if (payResponse.status === 200 && payData.redirectUrl) {
            return new Response(JSON.stringify({ payment_url: payData.redirectUrl }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        } else {
            console.error("PhonePe Pay Error:", payData);
            return new Response(JSON.stringify({ error: payData.message || "PhonePe Pay-link failed." }), {
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
