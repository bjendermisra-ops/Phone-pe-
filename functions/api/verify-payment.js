export async function onRequest(context) {
    const { request } = context;

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const url = new URL(request.url);
        let rawTxId = url.searchParams.get("transactionId") || url.searchParams.get("payment_id") || url.searchParams.get("txId");

        if (!rawTxId && request.method === "POST") {
            try {
                const body = await request.json();
                rawTxId = body.transactionId || body.payment_id || body.txId;
            } catch(e) {}
        }

        if (!rawTxId) {
            return new Response(JSON.stringify({ error: "Transaction ID / UTR is required." }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const cleanTxId = String(rawTxId).trim();

        // 🔑 Real PhonePe V2 Production Credentials
        const clientId = "SU2608031047283544010005";
        const clientSecret = "c869bf25-6f08-43b3-8b9b-dcdd5a066eb7";
        const clientVersion = 1;
        const merchantId = "SU2608031047283544010005";

        const tokenPayload = new URLSearchParams();
        tokenPayload.append("client_id", clientId);
        tokenPayload.append("client_version", clientVersion.toString());
        tokenPayload.append("client_secret", clientSecret);
        tokenPayload.append("grant_type", "client_credentials");

        let accessToken = null;

        // Step 1: Real Production Token Endpoint
        try {
            const tokenUrl = "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";
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

        // Fallback Token URL (sirf agar primary endpoint fail ho)
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
            return new Response(JSON.stringify({ error: "Failed to generate status check OAuth token." }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Step 2: Real Production Status Check API
        const statusUrl = `https://api.phonepe.com/apis/pg/checkout/v2/order/${cleanTxId}/status`;
        const response = await fetch(statusUrl, {
            method: "GET",
            headers: {
                "Authorization": "O-Bearer " + accessToken,
                "X-MERCHANT-ID": merchantId,
                "accept": "application/json"
            }
        });

        const data = await response.json();

        if (response.status === 200 && (data.state === "COMPLETED" || data.state === "SUCCESS")) {
            return new Response(JSON.stringify({ 
                status: 'success', 
                state: 'COMPLETED',
                message: 'Transaction successfully verified by PhonePe V2!',
                verified_payment_id: cleanTxId,
                data: data
            }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        } else {
            return new Response(JSON.stringify({ 
                status: 'pending',
                state: data.state || 'PENDING',
                message: data.message || 'Payment is processing'
            }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Server PhonePe V2 status verification failed.' }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
}
