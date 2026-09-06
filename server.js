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
const SUPABASE_SECRET_KEY =   process.env.SUPABASE_SECRET_KEY;
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_WEBRTC_CREDENTIAL_ID =
    process.env.TELNYX_WEBRTC_CREDENTIAL_ID;
const SIGNALWIRE_SPACE_NAME =
    process.env.SIGNALWIRE_SPACE_NAME;

const SIGNALWIRE_PROJECT_ID =
    process.env.SIGNALWIRE_PROJECT_ID;

const SIGNALWIRE_API_TOKEN =
    process.env.SIGNALWIRE_API_TOKEN;

const SIGNALWIRE_PHONE_NUMBER =
    process.env.SIGNALWIRE_PHONE_NUMBER;

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
// SIGNALWIRE SUBSCRIBER ACCESS TOKEN
// =========================================================

app.post("/api/signalwire-token", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        if (
            !SIGNALWIRE_SPACE_NAME ||
            !SIGNALWIRE_PROJECT_ID ||
            !SIGNALWIRE_API_TOKEN
        ) {
            return res.status(500).json({
                success: false,
                error: "SignalWire configuration is missing on the server."
            });
        }

        const user = auth.user;

        // Use a stable reference for this Dialeaze customer.
        const reference = `dialeaze_${user.id}`;

        const basicAuth = Buffer.from(
            `${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`
        ).toString("base64");

        const response = await fetch(
            `https://${SIGNALWIRE_SPACE_NAME}.signalwire.com/api/fabric/subscribers/tokens`,
            {
                method: "POST",
                headers: {
                    Authorization: `Basic ${basicAuth}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    reference,
                    display_name:
                        user.user_metadata?.full_name ||
                        user.email ||
                        "Dialeaze User"
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "SignalWire SAT creation failed:",
                response.status,
                data
            );

            return res.status(502).json({
                success: false,
                error:
                    data?.message ||
                    data?.error ||
                    "Unable to create SignalWire access token."
            });
        }

        return res.json({
            success: true,
            token: data.token,
            expiresAt: Date.now() + (2 * 60 * 60 * 1000),
            subscriberId: data.subscriber_id
        });

    } catch (error) {
        console.error(
            "SignalWire token endpoint error:",
            error
        );

        return res.status(500).json({
            success: false,
            error: "Unable to create SignalWire access token."
        });
    }
});

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
const signalWireAuth = Buffer.from(
    `${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`
).toString("base64");

const response = await fetch(
    `https://${SIGNALWIRE_SPACE_NAME}.signalwire.com/api/relay/rest/phone_numbers/search?max_results=100${areaCode ? `&areacode=${areaCode}` : ""}`,
    {
        method: "GET",
        headers: {
            Authorization: `Basic ${signalWireAuth}`,
            Accept: "application/json"
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

        const signalWireNumbers = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
        ? data.data
        : [];

return res.json({
    success: true,
    numbers: signalWireNumbers
        .map(number => ({
            phone_number:
                number.phone_number ||
                number.number ||
                number.e164,
            status: "available"
        }))
        .filter(number => number.phone_number)
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
        const areaCode = String(req.query.area_code || "").trim();

if (areaCode && !/^\d{3}$/.test(areaCode)) {
    return res.status(400).json({
        success: false,
        error: "Area code must be exactly 3 digits."
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
        const areaCode = String(req.query.area_code || "").trim();

if (areaCode && !/^\d{3}$/.test(areaCode)) {
    return res.status(400).json({
        success: false,
        error: "Area code must be exactly 3 digits."
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
       
        const credential =
    await telnyx.telephonyCredentials.retrieve(
        TELNYX_WEBRTC_CREDENTIAL_ID
    );

const sipUsername =
    credential?.data?.sip_username ||
    credential?.sip_username ||
    null;

if (!sipUsername) {
    return res.status(500).json({
        success: false,
        error: "Telnyx SIP username was not found."
    });
}
       
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
    phoneNumber: customerPhone,
    sipUsername
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
// WEBRTC AGENT PRESENCE
// =========================================================

const registeredAgents = new Map();

function registerAgent(userId, phoneNumber, sipUsername) {
    registeredAgents.set(userId, {
        userId,
        phoneNumber,
        sipUsername,
        registeredAt: new Date().toISOString(),
        lastSeen: Date.now()
    });

    console.log(
        "Dialeaze agent registered:",
        userId,
        phoneNumber
    );
}

function unregisterAgent(userId) {
    if (registeredAgents.has(userId)) {
        registeredAgents.delete(userId);

        console.log(
            "Dialeaze agent unregistered:",
            userId
        );
    }
}

function findRegisteredAgent(phoneNumber) {
    for (const agent of registeredAgents.values()) {
        if (agent.phoneNumber === phoneNumber) {
            return agent;
        }
    }

    return null;
}

// =========================================================
// WEBRTC AGENT REGISTRATION
// =========================================================

app.post("/api/webrtc/register", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
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

        const phoneNumber =
            profile.telnyx_phone_number ||
            "";

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error:
                    "No Telnyx phone number is assigned to this customer."
            });
        }

        const {
            sipUsername
        } = req.body || {};

        registerAgent(
            auth.user.id,
            phoneNumber,
            sipUsername || null
        );

        return res.json({
            success: true,
            registered: true,
            phoneNumber
        });

    } catch (error) {
        console.error(
            "WebRTC registration error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                error?.message ||
                "Unable to register WebRTC agent."
        });
    }
});


// =========================================================
// WEBRTC AGENT UNREGISTRATION
// =========================================================

app.post("/api/webrtc/unregister", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        unregisterAgent(auth.user.id);

        return res.json({
            success: true,
            registered: false
        });

    } catch (error) {
        console.error(
            "WebRTC unregistration error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                error?.message ||
                "Unable to unregister WebRTC agent."
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

// =========================================================
// TELNYX WEBHOOK
// =========================================================
// =========================================================
// CALL USAGE LIFECYCLE HELPERS
// =========================================================

async function updateCallUsageByProviderId(
    providerCallId,
    updates
) {
    if (!providerCallId) {
        return;
    }

    try {
        const query =
            `${SUPABASE_URL}/rest/v1/customer_call_usage` +
            `?provider_call_id=eq.${encodeURIComponent(providerCallId)}`;

        const response = await fetch(query, {
            method: "PATCH",
            headers: {
                Authorization:
                    `Bearer ${SUPABASE_SECRET_KEY}`,

                apikey:
                    SUPABASE_SECRET_KEY,

                "Content-Type":
                    "application/json",

                Prefer:
                    "return=representation"
            },
            body: JSON.stringify(updates)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "❌ Failed to update call usage:",
                data
            );
            return;
        }

        console.log(
            "✅ Call usage updated:",
            data
        );

    } catch (error) {
        console.error(
            "❌ Call usage update error:",
            error
        );
    }
}

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

        console.log(
            "TELNYX EVENT TYPE:",
            eventType
        );

        // =====================================================
        // INBOUND SMS
        // =====================================================

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

        // =====================================================
        // INBOUND VOICE CALL
        // =====================================================
if (eventType === "call.initiated") {
    const callControlId = payload?.call_control_id || "";
    const calledNumber =
        payload?.to ||
        payload?.called_party_number ||
        "";
    const callerNumber =
        payload?.from ||
        payload?.calling_party_number ||
        "";
    const connectionId = payload?.connection_id || "";
    const direction = payload?.direction || "";

    console.log("TELNYX CALL INITIATED:", {
        callControlId,
        callerNumber,
        calledNumber,
        connectionId,
        direction
    });

    if (!callControlId) {
        return res.json({
            success: true
        });
    }

    /*
     * IMPORTANT:
     *
     * Dialeaze has two types of calls:
     *
     * 1. INCOMING
     *    Customer -> Dialeaze phone number
     *
     * 2. OUTGOING
     *    Dialeaze browser -> Customer
     *
     * Only INCOMING calls should go through the
     * "find registered agent" routing logic below.
     *
     * Outgoing browser calls must be allowed to continue
     * normally through Telnyx.
     */

    if (direction !== "incoming") {
        console.log(
            "IGNORING NON-INCOMING CALL LEG:",
            {
                direction,
                connectionId,
                callerNumber,
                calledNumber
            }
        );

        return res.json({
            success: true,
            routed: false,
            reason: "Not an incoming customer call"
        });
    }

    /*
     * Ignore SIP URI destinations.
     *
     * These are WebRTC/SIP agent legs and are not
     * original PSTN customer calls.
     */
    if (
        typeof calledNumber === "string" &&
        calledNumber.startsWith("sip:")
    ) {
        console.log(
            "Ignoring SIP URI call leg:",
            calledNumber
        );

        return res.json({
            success: true,
            routed: false,
            reason: "SIP URI agent leg"
        });
    }

    /*
     * This is now confirmed to be the ORIGINAL
     * INCOMING CUSTOMER CALL.
     */
    console.log("INBOUND CUSTOMER CALL:", {
        callControlId,
        callerNumber,
        calledNumber
    });

    /*
     * Find the Dialeaze agent that owns the
     * called Dialeaze phone number.
     */
    const agent = findRegisteredAgent(calledNumber);

    if (!agent) {
        console.log(
            "No registered Dialeaze agent found for:",
            calledNumber
        );

        return res.json({
            success: true,
            routed: false,
            reason: "No registered agent"
        });
    }

    console.log(
        "REGISTERED DIALEAZE AGENT FOUND:",
        agent
    );

    if (!agent.sipUsername) {
        console.log(
            "Agent has no SIP username."
        );

        return res.json({
            success: true,
            routed: false,
            reason: "Agent has no SIP username"
        });
    }

    /*
     * SIP address of the browser/WebRTC agent.
     */
    const sipUri =
        `sip:${agent.sipUsername}@sip.telnyx.com`;

    /*
     * Answer the original incoming customer call.
     *
     * This is the PSTN/customer leg.
     */
    console.log(
        "ANSWERING ORIGINAL CUSTOMER CALL:",
        callControlId
    );

    try {
        await telnyx.calls.actions.answer(
            callControlId
        );

        console.log(
            "ORIGINAL CUSTOMER CALL ANSWERED."
        );
    } catch (answerError) {
        console.error(
            "FAILED TO ANSWER ORIGINAL CUSTOMER CALL:",
            answerError?.message ||
            answerError
        );

        return res.json({
            success: true,
            routed: false,
            reason: "Failed to answer incoming call"
        });
    }

    /*
     * Now create the WebRTC agent leg.
     *
     * link_to = original customer call
     * bridge_intent = bridge this call
     * bridge_on_answer = bridge when agent answers
     */
    console.log(
        "DIALING WEBRTC AGENT:",
        sipUri
    );

    try {
        const agentCall =
            await telnyx.calls.dial({
                connection_id:
                    process.env
                        .TELNYX_CALL_CONTROL_APP_ID,

                to: sipUri,

                from: calledNumber,

                link_to: callControlId,

                bridge_intent: true,

                bridge_on_answer: true,

                timeout_secs: 30
            });

        console.log(
            "WEBRTC AGENT CALL CREATED:",
            agentCall?.data?.call_control_id
        );

        console.log(
            "WAITING FOR WEBRTC AGENT TO ANSWER..."
        );

    } catch (dialError) {
        console.error(
            "WEBRTC AGENT DIAL FAILED:",
            dialError?.message ||
            dialError
        );

        /*
         * If the browser agent cannot be reached,
         * cleanly hang up the customer call.
         */
        try {
            await telnyx.calls.actions.hangup(
                callControlId
            );

            console.log(
                "ORIGINAL CUSTOMER CALL HUNG UP AFTER AGENT DIAL FAILURE."
            );

        } catch (hangupError) {
            console.error(
                "FAILED TO HANG UP CUSTOMER CALL:",
                hangupError?.message ||
                hangupError
            );
        }
    }
}

        // =====================================================
        // OTHER VOICE EVENTS
        // =====================================================

        if (
            eventType.startsWith("call.") &&
            eventType !== "call.initiated"
        ) {
            console.log(
                "Telnyx voice event:",
                eventType,
                payload
            );
        }

        return res.json({
            success: true
        });

    } catch (error) {

        console.error(
            "Telnyx webhook error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                error?.message ||
                "Webhook processing failed."
        });
    }
});

// =========================================================
// CUSTOMER CALL CONTROLS
// =========================================================

app.get("/api/call-controls", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/customer_call_controls` +
            `?user_id=eq.${encodeURIComponent(auth.user.id)}` +
            `&select=*`,
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
            console.error(
                "Customer call controls fetch error:",
                data
            );

            return res.status(response.status).json({
                success: false,
                error:
                    data?.message ||
                    "Unable to load call controls."
            });
        }

        // If the customer does not have a control record yet,
        // return a safe default response.
        if (!Array.isArray(data) || data.length === 0) {
            return res.json({
                success: true,
                allowed: false,
                status: "missing",
                error:
                    "Call controls have not been configured for this customer."
            });
        }

        const controls = data[0];

        const allowed =
            controls.status === "active";

        return res.json({
            success: true,
            allowed,
            controls: {
                status: controls.status,
                riskScore: controls.risk_score,
                hourlyCallLimit: controls.hourly_call_limit,
                dailyCallLimit: controls.daily_call_limit,
                dailyMinuteLimit: controls.daily_minute_limit,
                monthlyMinuteLimit: controls.monthly_minute_limit,
                callsToday: controls.calls_today,
                callsThisHour: controls.calls_this_hour,
                minutesToday: Number(controls.minutes_today) || 0,
                minutesThisMonth:
                    Number(controls.minutes_this_month) || 0,
                lastCallAt: controls.last_call_at,
                suspensionReason:
                    controls.suspension_reason || null
            }
        });

    } catch (error) {
        console.error(
            "Call controls error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Unable to check customer call controls."
        });
    }
});

// =========================================================
// OUTBOUND CALL AUTHORIZATION
// ATOMIC SERVER-SIDE CALL LIMIT ENFORCEMENT
// =========================================================

app.post("/api/outbound-call/authorize", async (req, res) => {

    try {

        // -------------------------------------------------
        // AUTHENTICATE CUSTOMER
        // -------------------------------------------------

        const auth = await authenticateRequest(req);

        if (!auth.success) {

            return res.status(auth.status).json({
                success: false,
                allowed: false,
                error: auth.error
            });

        }


        const userId = auth.user.id;

        const {
            destinationNumber,
            callerNumber
        } = req.body;


        // -------------------------------------------------
        // BASIC INPUT VALIDATION
        // -------------------------------------------------

        if (!destinationNumber) {

            return res.status(400).json({
                success: false,
                allowed: false,
                error: "Destination phone number is required."
            });

        }


        if (!callerNumber) {

            return res.status(400).json({
                success: false,
                allowed: false,
                error: "Caller phone number is required."
            });

        }


        // -------------------------------------------------
        // BASIC E.164 VALIDATION
        // Example:
        // +14155551234
        // -------------------------------------------------

        const e164Pattern =
            /^\+[1-9]\d{7,14}$/;


        if (!e164Pattern.test(destinationNumber)) {

            return res.status(400).json({
                success: false,
                allowed: false,
                error:
                    "Please enter a valid phone number in international format."
            });

        }


        if (!e164Pattern.test(callerNumber)) {

            return res.status(400).json({
                success: false,
                allowed: false,
                error:
                    "Invalid caller phone number."
            });

        }


        // -------------------------------------------------
        // CALL SUPABASE ATOMIC AUTHORIZATION FUNCTION
        // -------------------------------------------------

        console.log(
            "🔐 Requesting atomic outbound authorization:",
            {
                userId,
                destinationNumber
            }
        );


        const rpcResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/authorize_outbound_call`,
            {
                method: "POST",

                headers: {
                    Authorization:
                        `Bearer ${auth.token}`,

                    apikey:
                        SUPABASE_PUBLISHABLE_KEY,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    p_user_id:
                        userId,

                    p_destination_number:
                        destinationNumber,

                    p_caller_number:
                        callerNumber
                })
            }
        );


        const authorizationData =
            await rpcResponse.json();


        console.log(
            "🔐 Supabase outbound authorization:",
            authorizationData
        );


        // -------------------------------------------------
        // SUPABASE/RPC ERROR
        // -------------------------------------------------

        if (!rpcResponse.ok) {

            console.error(
                "❌ Outbound authorization RPC error:",
                authorizationData
            );


            return res.status(500).json({
                success: false,
                allowed: false,
                error:
                    "Unable to authorize this call."
            });

        }


        // -------------------------------------------------
        // CALL BLOCKED
        // -------------------------------------------------

        if (
            !authorizationData.success ||
            !authorizationData.allowed
        ) {

            console.warn(
                "🚫 OUTBOUND CALL BLOCKED:",
                {
                    userId,
                    reason:
                        authorizationData.reason,
                    error:
                        authorizationData.error
                }
            );


            return res.status(
                authorizationData.reason === "account_status"
                    ? 403
                    : 429
            ).json({

                success: true,

                allowed: false,

                reason:
                    authorizationData.reason,

                status:
                    authorizationData.status || null,

                error:
                    authorizationData.error ||
                    "Calling is currently unavailable."
            });

        }


        // -------------------------------------------------
        // AUTHORIZATION PASSED
        // -------------------------------------------------

        console.log(
            "✅ OUTBOUND CALL AUTHORIZED:",
            {
                userId,
                usageId:
                    authorizationData.usage_id,
                callsThisHour:
                    authorizationData.calls_this_hour,
                callsToday:
                    authorizationData.calls_today
            }
        );


        return res.json({

            success: true,

            allowed: true,

            usageId:
                authorizationData.usage_id,

            controls: {

                callsThisHour:
                    authorizationData.calls_this_hour,

                callsToday:
                    authorizationData.calls_today,

                minutesToday:
                    Number(
                        authorizationData.minutes_today
                    ) || 0,

                minutesThisMonth:
                    Number(
                        authorizationData.minutes_this_month
                    ) || 0

            }

        });


    } catch (error) {

        console.error(
            "❌ Outbound call authorization error:",
            error
        );


        return res.status(500).json({

            success: false,

            allowed: false,

            error:
                "Unable to authorize this call."

        });

    }

});


// =========================================================
// LINK OUTBOUND USAGE TO PROVIDER CALL
// =========================================================

app.post("/api/outbound-call/link", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const userId = auth.user.id;
        const { usageId, providerCallId } = req.body;

        if (!usageId || !providerCallId) {
            return res.status(400).json({
                success: false,
                error: "usageId and providerCallId are required."
            });
        }

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/customer_call_usage` +
            `?id=eq.${encodeURIComponent(usageId)}` +
            `&user_id=eq.${encodeURIComponent(userId)}`,
            {
                method: "PATCH",
                headers: {
                    Authorization:
                        `Bearer ${SUPABASE_SECRET_KEY}`,

                    apikey:
                        SUPABASE_SECRET_KEY,

                    "Content-Type":
                        "application/json",

                    Prefer:
                        "return=representation"
                },
                body: JSON.stringify({
                    provider_call_id: providerCallId
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "❌ Failed to link provider call:",
                data
            );

            return res.status(500).json({
                success: false,
                error: "Unable to link provider call."
            });
        }

        console.log(
            "✅ Provider call linked to usage:",
            {
                userId,
                usageId,
                providerCallId
            }
        );

        return res.json({
            success: true,
            usageId,
            providerCallId
        });

    } catch (error) {
        console.error(
            "❌ Provider call link error:",
            error
        );

        return res.status(500).json({
            success: false,
            error: "Unable to link provider call."
        });
    }
});

// =========================================================
// UPDATE OUTBOUND CALL USAGE LIFECYCLE
// =========================================================

app.post("/api/outbound-call/update", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const userId = auth.user.id;

        const {
            usageId,
            callStatus,
            answered,
            answeredAt,
            endedAt,
            durationSeconds
        } = req.body;

        if (!usageId) {
            return res.status(400).json({
                success: false,
                error: "usageId is required."
            });
        }

        const allowedStatuses = [
            "started",
            "ringing",
            "answered",
            "completed",
            "failed",
            "rejected",
            "cancelled"
        ];

        if (
            callStatus &&
            !allowedStatuses.includes(callStatus)
        ) {
            return res.status(400).json({
                success: false,
                error: "Invalid call status."
            });
        }

        const updateData = {};

        if (callStatus) {
            updateData.call_status = callStatus;
        }

        if (typeof answered === "boolean") {
            updateData.answered = answered;
        }

        if (answeredAt) {
            updateData.answered_at = answeredAt;
        }

        if (endedAt) {
            updateData.ended_at = endedAt;
        }

        if (
            durationSeconds !== undefined &&
            durationSeconds !== null
        ) {
            const parsedDuration =
                Number(durationSeconds);

            if (
                !Number.isFinite(parsedDuration) ||
                parsedDuration < 0
            ) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid durationSeconds."
                });
            }

            updateData.duration_seconds =
                Math.floor(parsedDuration);
        }


        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/customer_call_usage` +
            `?id=eq.${encodeURIComponent(usageId)}` +
            `&user_id=eq.${encodeURIComponent(userId)}`,
            {
                method: "PATCH",

                headers: {
                    Authorization:
                        `Bearer ${SUPABASE_SECRET_KEY}`,

                    apikey:
                        SUPABASE_SECRET_KEY,

                    "Content-Type":
                        "application/json",

                    Prefer:
                        "return=representation"
                },

                body:
                    JSON.stringify(updateData)
            }
        );

        const data =
            await response.json();

        if (!response.ok) {
            console.error(
                "❌ Failed to update outbound call usage:",
                data
            );

            return res.status(500).json({
                success: false,
                error:
                    "Unable to update call usage."
            });
        }

        return res.json({
            success: true,
            usageId,
            updated: data
        });

    } catch (error) {

        console.error(
            "❌ Outbound call lifecycle update error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Unable to update call lifecycle."
        });
    }
});
        

app.post("/api/signalwire/inbound-swml", (req, res) => {
    console.log("📞 SIGNALWIRE INBOUND CALL RECEIVED");
    console.log("SWML request:", req.body);

    return res.json({
        version: "1.0.0",
        sections: {
            main: [
                {
                    connect: {
                        to: "/private/junaid-sabir",
                        timeout: 60
                    }
                }
            ]
        }
    });
});
// =========================================================
// FRONTEND FALLBACK
// =========================================================
app.use((req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});
    
app.listen(PORT, () => {
    console.log("");
    console.log("==========================================");
    console.log("       DIALEAZE DIALER SERVER");
    console.log("==========================================");
    console.log(`Server running on port ${PORT}`);
    console.log(`Local URL: http://localhost:${PORT}`);
    console.log("");
});