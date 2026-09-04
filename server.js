const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const Telnyx = require("telnyx");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// =========================================================
// CONFIGURATION
// =========================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_WEBRTC_CREDENTIAL_ID =
    process.env.TELNYX_WEBRTC_CREDENTIAL_ID;

if (!SUPABASE_URL) {
    console.warn("WARNING: SUPABASE_URL is missing from .env");
}

if (!SUPABASE_PUBLISHABLE_KEY) {
    console.warn("WARNING: SUPABASE_PUBLISHABLE_KEY is missing from .env");
}

if (!TELNYX_API_KEY) {
    console.warn("WARNING: TELNYX_API_KEY is missing from .env");
}

if (!TELNYX_WEBRTC_CREDENTIAL_ID) {
    console.warn(
        "WARNING: TELNYX_WEBRTC_CREDENTIAL_ID is missing from .env"
    );
}

// =========================================================
// TELNYX CLIENT
// =========================================================

const telnyx = TELNYX_API_KEY
    ? new Telnyx({ apiKey: TELNYX_API_KEY })
    : null;

// =========================================================
// MIDDLEWARE
// =========================================================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// =========================================================
// HELPER: GET BEARER TOKEN
// =========================================================

function getBearerToken(req) {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
        return null;
    }

    return authorization.substring(7).trim();
}

// =========================================================
// HELPER: AUTHENTICATE SUPABASE USER
// =========================================================

async function authenticateRequest(req) {
    try {
        const token = getBearerToken(req);

        if (!token) {
            return {
                success: false,
                status: 401,
                error: "Missing authentication token."
            };
        }

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            return {
                success: false,
                status: 500,
                error: "Supabase configuration is missing on the server."
            };
        }

        const response = await fetch(
            `${SUPABASE_URL}/auth/v1/user`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    apikey: SUPABASE_PUBLISHABLE_KEY
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data || !data.id) {
            return {
                success: false,
                status: 401,
                error: "Your login session is invalid or expired."
            };
        }

        return {
            success: true,
            user: data,
            token
        };
    } catch (error) {
        console.error("Supabase authentication error:", error);

        return {
            success: false,
            status: 500,
            error: "Unable to verify your login session."
        };
    }
}

// =========================================================
// HELPER: GET CUSTOMER PROFILE
// =========================================================

async function getProfile(token, userId) {
    try {
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            throw new Error("Supabase configuration is missing.");
        }

        const url =
            `${SUPABASE_URL}/rest/v1/profiles` +
            `?id=eq.${encodeURIComponent(userId)}` +
            `&select=*`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                apikey: SUPABASE_PUBLISHABLE_KEY
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Supabase profile error:", data);

            throw new Error(
                data.message ||
                data.error_description ||
                "Unable to load customer profile."
            );
        }

        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        return data[0];
    } catch (error) {
        console.error("getProfile error:", error);
        throw error;
    }
}

// =========================================================
// HEALTH CHECK
// =========================================================

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Dialeaze Dialer server is running.",
        time: new Date().toISOString()
    });
});

// =========================================================
// TELNYX TEST
// =========================================================

app.get("/api/telnyx-test", async (req, res) => {
    try {
        if (!telnyx) {
            return res.status(500).json({
                success: false,
                error: "Telnyx API key is missing."
            });
        }

        return res.json({
            success: true,
            message: "Telnyx client is configured."
        });
    } catch (error) {
        console.error("Telnyx test error:", error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =========================================================
// ACCOUNT
// =========================================================

app.get("/api/account", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const user = auth.user;

        const profile = await getProfile(
            auth.token,
            user.id
        );

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: "Customer profile was not found."
            });
        }

        // IMPORTANT:
        // app.js expects the account information
        // inside data.account

        return res.json({
            success: true,

            account: {
                id: user.id,

                email:
                    profile.email ||
                    user.email ||
                    "",

                displayName:
                    profile.full_name ||
                    "",

                phoneNumber:
                    profile.telnyx_phone_number ||
                    "",

                telnyxPhoneNumber:
                    profile.telnyx_phone_number ||
                    "",

                subscriptionPlan:
                    profile.subscription_plan ||
                    "free",

                subscriptionStatus:
                    profile.subscription_status ||
                    "inactive"
            }
        });
    } catch (error) {
        console.error("Account error:", error);

        return res.status(500).json({
            success: false,
            error: "Unable to load your customer account."
        });
    }
});
app.get("/api/call-history", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/call_history?user_id=eq.${auth.user.id}&order=created_at.desc`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                    apikey: SUPABASE_PUBLISHABLE_KEY
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Call history fetch error:", data);

            return res.status(response.status).json({
                success: false,
                error:
                    data?.message ||
                    "Unable to load call history."
            });
        }

        return res.json({
            success: true,
            calls: data || []
        });
    } catch (error) {
        console.error("Call history GET error:", error);

        return res.status(500).json({
            success: false,
            error: "Unable to load call history."
        });
    }
});

app.get("/api/phone-numbers", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/phone_numbers?select=id,phone_number,user_id,status,created_at,updated_at&or=(user_id.eq.${auth.user.id},status.eq.available)&order=status.asc,created_at.asc`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                    apikey: SUPABASE_PUBLISHABLE_KEY
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Phone numbers fetch error:", data);

            return res.status(response.status).json({
                success: false,
                error:
                    data?.message ||
                    "Unable to load phone numbers."
            });
        }

        return res.json({
            success: true,
            numbers: data || []
        });

    } catch (error) {
        console.error("Phone numbers GET error:", error);

        return res.status(500).json({
            success: false,
            error: "Unable to load phone numbers."
        });
    }
});

app.post("/api/phone-numbers/claim", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: "Phone number is required."
            });
        }

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/claim_phone_number`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                    apikey: SUPABASE_PUBLISHABLE_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    requested_phone_number: phoneNumber
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Phone number claim error:", data);

            return res.status(response.status).json({
                success: false,
                error:
                    data?.message ||
                    data?.hint ||
                    "Unable to claim this phone number."
            });
        }

        return res.json({
            success: true,
            number: data
        });

    } catch (error) {
        console.error("Phone number claim error:", error);

        return res.status(500).json({
            success: false,
            error: "Unable to claim this phone number."
        });
    }
});

app.post("/api/call-history", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const {
            phoneNumber,
            callerNumber,
            direction,
            status,
            startedAt,
            connectedAt,
            endedAt,
            duration
        } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: "Phone number is required."
            });
        }

        const callRecord = {
            user_id: auth.user.id,
            phone_number: phoneNumber,
            caller_number: callerNumber || null,
            direction: direction || "outbound",
            status: status || "completed",
            started_at: startedAt || null,
            connected_at: connectedAt || null,
            ended_at: endedAt || null,
            duration: Number(duration) || 0
        };

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/call_history`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                    apikey: SUPABASE_PUBLISHABLE_KEY,
                    "Content-Type": "application/json",
                    Prefer: "return=representation"
                },
                body: JSON.stringify(callRecord)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Call history save error:", data);

            return res.status(response.status).json({
                success: false,
                error:
                    data?.message ||
                    "Unable to save call history."
            });
        }

        return res.json({
            success: true,
            call: data?.[0] || callRecord
        });
    } catch (error) {
        console.error("Call history POST error:", error);

        return res.status(500).json({
            success: false,
            error: "Unable to save call history."
        });
    }
});
// =========================================================
// TELNYX WEBRTC TOKEN
// =========================================================

app.get("/api/telnyx-token", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        if (!telnyx) {
            return res.status(500).json({
                success: false,
                error: "Telnyx is not configured."
            });
        }

        if (!TELNYX_WEBRTC_CREDENTIAL_ID) {
            return res.status(500).json({
                success: false,
                error: "Telnyx WebRTC credential ID is missing."
            });
        }

        const profile = await getProfile(
            auth.token,
            auth.user.id
        );

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: "Customer profile was not found."
            });
        }

        const customerPhone =
            profile.telnyx_phone_number ||
            process.env.TELNYX_PHONE_NUMBER ||
            "";

        if (!customerPhone) {
            return res.status(400).json({
                success: false,
                error:
                    "No Telnyx phone number is assigned to this customer."
            });
        }

        // Create Telnyx WebRTC token
        const response =
            await telnyx.telephonyCredentials.createToken(
                TELNYX_WEBRTC_CREDENTIAL_ID
            );

        const token =
    typeof response === "string"
        ? response
        : response?.data?.token ||
          response?.token ||
          null;

if (!token) {
    console.error(
        "Unexpected Telnyx token response:",
        response
    );

    return res.status(500).json({
        success: false,
        error: "Telnyx did not return a WebRTC token."
    });
}

        return res.json({
            success: true,
            token,
            phoneNumber: customerPhone
        });
    } catch (error) {
        console.error("Telnyx token error:", error);

        return res.status(500).json({
            success: false,
            error:
                error?.message ||
                "Unable to create Telnyx WebRTC token."
        });
    }
});

// =========================================================
// TEMPORARY MESSAGE STORAGE
// =========================================================

const messages = [];

// =========================================================
// SEND SMS
// =========================================================

app.post("/api/messages/send", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        if (!telnyx) {
            return res.status(500).json({
                success: false,
                error: "Telnyx is not configured."
            });
        }

        const { to, text } = req.body;

        if (!to) {
            return res.status(400).json({
                success: false,
                error: "Recipient phone number is required."
            });
        }

        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                error: "Message text is required."
            });
        }

        const profile = await getProfile(
            auth.token,
            auth.user.id
        );

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: "Customer profile was not found."
            });
        }

        const fromNumber =
            profile.telnyx_phone_number ||
            process.env.TELNYX_PHONE_NUMBER ||
            "";

        if (!fromNumber) {
            return res.status(400).json({
                success: false,
                error:
                    "No Telnyx phone number is assigned to this customer."
            });
        }

        const sms = await telnyx.messages.send({
            from: fromNumber,
            to: to,
            text: text.trim()
        });

        const messageRecord = {
            id:
                sms?.data?.id ||
                sms?.id ||
                `msg_${Date.now()}`,

            userId: auth.user.id,

            from: fromNumber,

            to,

            text: text.trim(),

            direction: "outbound",

            createdAt: new Date().toISOString()
        };

        messages.push(messageRecord);

        return res.json({
            success: true,
            message: messageRecord
        });
    } catch (error) {
        console.error("Send message error:", error);

        return res.status(500).json({
            success: false,
            error:
                error?.message ||
                "Unable to send message."
        });
    }
});

// =========================================================
// GET MESSAGES
// =========================================================

app.get("/api/messages", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const phone = req.query.phone || "";

        const userMessages = messages.filter((message) => {
            if (message.userId !== auth.user.id) {
                return false;
            }

            if (!phone) {
                return true;
            }

            return (
                message.to === phone ||
                message.from === phone
            );
        });

        return res.json({
            success: true,
            messages: userMessages
        });
    } catch (error) {
        console.error("Get messages error:", error);

        return res.status(500).json({
            success: false,
            error: "Unable to load messages."
        });
    }
});

// =========================================================
// TELNYX WEBHOOK
// =========================================================

app.post("/api/telnyx/webhook", async (req, res) => {
    try {
        const event = req.body;

        console.log(
            "TELNYX WEBHOOK:",
            JSON.stringify(event, null, 2)
        );

        const eventType =
            event?.data?.event_type ||
            event?.event_type ||
            "";

        const payload =
            event?.data?.payload ||
            event?.payload ||
            {};

        // -----------------------------------------------------
        // INBOUND SMS
        // -----------------------------------------------------

        if (
            eventType === "message.received" ||
            eventType === "message.received.v1"
        ) {
            const from =
                payload?.from?.phone_number ||
                payload?.from ||
                "";

            const to =
                payload?.to?.phone_number ||
                payload?.to ||
                "";

            const text =
                payload?.text ||
                "";

            const inboundMessage = {
                id:
                    payload?.id ||
                    `inbound_${Date.now()}`,

                userId: null,

                from,

                to,

                text,

                direction: "inbound",

                createdAt: new Date().toISOString()
            };

            messages.push(inboundMessage);

            console.log(
                "Inbound SMS received:",
                inboundMessage
            );
        }

        // -----------------------------------------------------
        // VOICE EVENTS
        // -----------------------------------------------------

        if (
            eventType.startsWith("call.") ||
            eventType.includes("call")
        ) {
            console.log(
                "Telnyx voice event:",
                eventType
            );
        }

        return res.status(200).json({
            success: true
        });
    } catch (error) {
        console.error(
            "Telnyx webhook error:",
            error
        );

        // Always return 200 to avoid repeated webhook retries
        return res.status(200).json({
            success: false,
            error: error.message
        });
    }
});

// =========================================================
// FRONTEND FALLBACK
// =========================================================

// Express 5 can reject app.get("*"), so we use
// a normal middleware fallback instead.

app.use((req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

// =========================================================
// START SERVER
// =========================================================

app.listen(PORT, () => {
    console.log("");
    console.log("==========================================");
    console.log("       DIALEAZE DIALER SERVER");
    console.log("==========================================");
    console.log(`Server running on port ${PORT}`);
    console.log(`Local URL: http://localhost:${PORT}`);
    console.log("");
});