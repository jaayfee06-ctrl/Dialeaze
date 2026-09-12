const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// =========================================================
// CONFIGURATION
// =========================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY =   process.env.SUPABASE_SECRET_KEY;
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
// HELPER: GET USER ORGANIZATION
// =========================================================
//
// This is the central organization lookup for Dialeaze.
// It determines which organization the authenticated user
// belongs to and what role they have.
//
// IMPORTANT:
// This does NOT modify any existing calling, messaging,
// voicemail, recording, contacts, or billing data.
// =========================================================

async function getUserOrganization(userId) {
    try {
        if (
            !SUPABASE_URL ||
            !SUPABASE_SECRET_KEY
        ) {
            throw new Error(
                "Supabase server configuration is missing."
            );
        }

        // Find the user's active organization membership.
        const membershipResponse =
            await fetch(
                `${SUPABASE_URL}/rest/v1/organization_members` +
                `?user_id=eq.${encodeURIComponent(userId)}` +
                `&status=eq.active` +
                `&select=id,organization_id,user_id,email,role,status,joined_at` +
                `&order=created_at.asc` +
                `&limit=1`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${SUPABASE_SECRET_KEY}`,
                        apikey:
                            SUPABASE_SECRET_KEY,
                        Accept:
                            "application/json"
                    }
                }
            );

        const membershipData =
            await membershipResponse.json();

        if (!membershipResponse.ok) {
            console.error(
                "Organization membership lookup error:",
                membershipData
            );

            throw new Error(
                membershipData?.message ||
                "Unable to load organization membership."
            );
        }

        if (
            !Array.isArray(membershipData) ||
            membershipData.length === 0
        ) {
            return null;
        }

        const membership =
            membershipData[0];

        // Load the organization itself.
        const organizationResponse =
            await fetch(
                `${SUPABASE_URL}/rest/v1/organizations` +
                `?id=eq.${encodeURIComponent(
                    membership.organization_id
                )}` +
                `&select=id,name,owner_user_id,plan,status,created_at,updated_at` +
                `&limit=1`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${SUPABASE_SECRET_KEY}`,
                        apikey:
                            SUPABASE_SECRET_KEY,
                        Accept:
                            "application/json"
                    }
                }
            );

        const organizationData =
            await organizationResponse.json();

        if (!organizationResponse.ok) {
            console.error(
                "Organization lookup error:",
                organizationData
            );

            throw new Error(
                organizationData?.message ||
                "Unable to load organization."
            );
        }

        if (
            !Array.isArray(organizationData) ||
            organizationData.length === 0
        ) {
            return null;
        }

        const organization =
            organizationData[0];

        return {
            id:
                organization.id,

            name:
                organization.name,

            ownerUserId:
                organization.owner_user_id,

            plan:
                organization.plan,

            status:
                organization.status,

            role:
                membership.role,

            memberStatus:
                membership.status,

            membershipId:
                membership.id,

            joinedAt:
                membership.joined_at || null
        };

    } catch (error) {
        console.error(
            "getUserOrganization error:",
            error
        );

        throw error;
    }
}

// =========================================================
// DIALEAZE ORGANIZATION PERMISSIONS
// =========================================================
//
// These helpers provide the authorization foundation for
// multi-user Dialeaze organizations.
//
// ROLE HIERARCHY:
//
// owner  → full organization control
// admin  → team + number management
// member → own Dialeaze communications
//
// IMPORTANT:
// These helpers do not change any existing communication
// routes yet. They will be used by future organization
// endpoints such as Team Members and Number Assignment.
// =========================================================
// =========================================================
// DIALEAZE SUBSCRIPTION HELPERS
// =========================================================

async function getUserSubscription(userId) {
    try {
        if (!userId) {
            return null;
        }

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/subscriptions` +
            `?user_id=eq.${encodeURIComponent(userId)}` +
            `&status=in.(pending,active,past_due,paused)` +
            `&order=created_at.desc` +
            `&limit=1`,
            {
                method: "GET",
                headers: {
                    Authorization:
                        `Bearer ${SUPABASE_SECRET_KEY}`,
                    apikey:
                        SUPABASE_SECRET_KEY,
                    Accept:
                        "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "Subscription lookup error:",
                data
            );

            return null;
        }

        if (
            !Array.isArray(data) ||
            data.length === 0
        ) {
            return null;
        }

        return data[0];

    } catch (error) {
        console.error(
            "getUserSubscription error:",
            error
        );

        return null;
    }
}


// =========================================================
// CHECK WHETHER SUBSCRIPTION IS ACTIVE
// =========================================================

function subscriptionAllowsService(subscription) {
    if (!subscription) {
        return false;
    }

    const status =
        String(
            subscription.status || ""
        ).toLowerCase();

    return (
        status === "active" ||
        status === "past_due"
    );
}


// =========================================================
// CHECK BUSINESS PLAN
// =========================================================

function subscriptionIsBusiness(subscription) {
    if (!subscription) {
        return false;
    }

    return (
        String(
            subscription.plan || ""
        ).toLowerCase() === "business"
    );
}

async function requireOrganizationMember(req) {
    const auth =
        await authenticateRequest(req);

    if (!auth.success) {
        return {
            success: false,
            status: auth.status,
            error: auth.error
        };
    }

    const organization =
        await getUserOrganization(
            auth.user.id
        );

    if (!organization) {
        return {
            success: false,
            status: 403,
            error:
                "Your Dialeaze account is not connected to an active organization."
        };
    }

    if (
        organization.status !== "active"
    ) {
        return {
            success: false,
            status: 403,
            error:
                "Your Dialeaze organization is not active."
        };
    }

    if (
        organization.memberStatus !== "active"
    ) {
        return {
            success: false,
            status: 403,
            error:
                "Your organization membership is not active."
        };
    }

    return {
        success: true,
        user: auth.user,
        organization
    };
}


async function requireOrganizationAdmin(req) {
    const result =
        await requireOrganizationMember(
            req
        );

    if (!result.success) {
        return result;
    }

    const role =
        String(
            result.organization.role || ""
        ).toLowerCase();

    if (
        role !== "owner" &&
        role !== "admin"
    ) {
        return {
            success: false,
            status: 403,
            error:
                "Owner or Admin permission is required."
        };
    }

    return result;
}


async function requireOrganizationOwner(req) {
    const result =
        await requireOrganizationMember(
            req
        );

    if (!result.success) {
        return result;
    }

    const role =
        String(
            result.organization.role || ""
        ).toLowerCase();

    if (role !== "owner") {
        return {
            success: false,
            status: 403,
            error:
                "Owner permission is required."
        };
    }

    return result;
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

// Check whether this Dialeaze account has been provisioned
// for SignalWire. Never create a SignalWire Subscriber
// simply because someone signed up or opened the dialer.
const profile = await getProfile(auth.token, user.id);

if (
    !profile ||
    profile.signalwire_provisioned !== true ||
    !profile.signalwire_subscriber_id
) {
    return res.status(403).json({
        success: false,
        error: "Your Dialeaze account is not provisioned for calling yet."
    });
}

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
// =====================================================
// GET ASSIGNED DIALEAZE PHONE NUMBER
// Used by messaging without changing legacy call data.
// =====================================================

let assignedPhoneNumber = "";

const assignedPhoneResponse =
    await fetch(
        `${SUPABASE_URL}/rest/v1/phone_numbers` +
        `?user_id=eq.${encodeURIComponent(auth.user.id)}` +
        `&status=eq.assigned` +
        `&select=phone_number` +
        `&limit=1`,
        {
            method: "GET",
            headers: {
                Authorization:
                    `Bearer ${SUPABASE_SECRET_KEY}`,
                apikey:
                    SUPABASE_SECRET_KEY,
                Accept:
                    "application/json"
            }
        }
    );

const assignedPhoneData =
    await assignedPhoneResponse.json();

if (
    assignedPhoneResponse.ok &&
    Array.isArray(assignedPhoneData) &&
    assignedPhoneData.length
) {
    assignedPhoneNumber =
        assignedPhoneData[0].phone_number ||
        "";
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
    assignedPhoneNumber ||
    "",


telnyxPhoneNumber:
    "",
                    assignedPhoneNumber:
                 assignedPhoneNumber,

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

// =========================================================
// ORGANIZATION
// =========================================================
//
// Returns the organization and membership information
// for the currently authenticated Dialeaze user.
//
// This is the first organization-aware backend endpoint.
// =========================================================
// =========================================================
// GET CURRENT DIALEAZE SUBSCRIPTION
// =========================================================

app.get(
    "/api/subscription",
    async (req, res) => {
        try {
            const auth =
                await authenticateRequest(req);

            if (!auth.success) {
                return res.status(
                    auth.status
                ).json({
                    success: false,
                    error: auth.error
                });
            }

            const subscription =
                await getUserSubscription(
                    auth.user.id
                );

            if (!subscription) {
                return res.status(404).json({
                    success: false,
                    error:
                        "No active Dialeaze subscription was found."
                });
            }

            return res.json({
                success: true,

                subscription: {
                    id:
                        subscription.id,

                    plan:
                        subscription.plan,

                    status:
                        subscription.status,

                    amountCents:
                        subscription.amount_cents,

                    billingInterval:
                        subscription.billing_interval,

                    currentPeriodStart:
                        subscription.current_period_start,

                    currentPeriodEnd:
                        subscription.current_period_end,

                    nextBillingDate:
                        subscription.next_billing_date,

                    gateway:
                        subscription.gateway,

                    cancelAtPeriodEnd:
                        subscription.cancel_at_period_end,

                    cancelledAt:
                        subscription.cancelled_at,

                    lastPaymentAt:
                        subscription.last_payment_at,

                    lastPaymentStatus:
                        subscription.last_payment_status
                }
            });

        } catch (error) {
            console.error(
                "Subscription GET error:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    "Unable to load your subscription."
            });
        }
    }
);

app.get("/api/organization", async (req, res) => {
    try {
        const auth =
            await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const organization =
            await getUserOrganization(
                auth.user.id
            );

        if (!organization) {
            return res.status(404).json({
                success: false,
                error:
                    "Your Dialeaze account is not connected to an organization yet."
            });
        }

        return res.json({
            success: true,
            organization
        });

    } catch (error) {
        console.error(
            "Organization GET error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Unable to load your Dialeaze organization."
        });
    }
});

// =========================================================
// ORGANIZATION PERMISSION TEST
// =========================================================
//
// Temporary/diagnostic endpoint for verifying that the
// authenticated user's organization role is being resolved
// correctly.
//
// This endpoint is intentionally read-only.
// =========================================================

app.get(
    "/api/organization/access",
    async (req, res) => {
        try {
            const member =
                await requireOrganizationMember(
                    req
                );

            if (!member.success) {
                return res.status(
                    member.status
                ).json({
                    success: false,
                    error: member.error
                });
            }

            const role =
                String(
                    member.organization.role ||
                    ""
                ).toLowerCase();

            return res.json({
                success: true,

                organization: {
                    id:
                        member.organization.id,

                    name:
                        member.organization.name,

                    plan:
                        member.organization.plan,

                    status:
                        member.organization.status
                },

                membership: {
                    id:
                        member.organization.membershipId,

                    role:
                        role,

                    status:
                        member.organization.memberStatus
                },

                permissions: {
                    canUseDialer: true,

                    canManageOwnAccount: true,

                    canManageTeam:
                        role === "owner" ||
                        role === "admin",

                    canManageNumbers:
                        role === "owner" ||
                        role === "admin",

                    canViewTeamActivity:
                        role === "owner" ||
                        role === "admin",

                    canManageBilling:
                        role === "owner",

                    canManageOrganization:
                        role === "owner"
                }
            });

        } catch (error) {
            console.error(
                "Organization access test error:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    "Unable to determine organization permissions."
            });
        }
    }
);

// =========================================================
// ORGANIZATION TEAM MEMBERS
// =========================================================
//
// Returns all members belonging to the authenticated user's
// organization.
//
// OWNER / ADMIN:
//     Can see the complete organization member list.
//
// MEMBER:
//     Can see the organization membership list as well,
//     but future private communication data will still be
//     protected separately.
//
// This endpoint is READ-ONLY.
// =========================================================

app.get(
    "/api/organization/members",
    async (req, res) => {
        try {
            const organizationAccess =
                await requireOrganizationMember(
                    req
                );

            if (!organizationAccess.success) {
                return res.status(
                    organizationAccess.status
                ).json({
                    success: false,
                    error:
                        organizationAccess.error
                });
            }

            const organizationId =
                organizationAccess.organization.id;

            const response =
                await fetch(
                    `${SUPABASE_URL}/rest/v1/organization_members` +
                    `?organization_id=eq.${encodeURIComponent(
                        organizationId
                    )}` +
                    `&select=id,organization_id,user_id,email,role,status,joined_at,created_at,updated_at` +
                    `&order=created_at.asc`,
                    {
                        method: "GET",
                        headers: {
                            Authorization:
                                `Bearer ${SUPABASE_SECRET_KEY}`,
                            apikey:
                                SUPABASE_SECRET_KEY,
                            Accept:
                                "application/json"
                        }
                    }
                );

            const members =
                await response.json();

            if (!response.ok) {
                console.error(
                    "Organization members lookup error:",
                    members
                );

                return res.status(
                    response.status
                ).json({
                    success: false,
                    error:
                        members?.message ||
                        "Unable to load organization members."
                });
            }

            return res.json({
                success: true,

                organization: {
                    id:
                        organizationAccess
                            .organization.id,

                    name:
                        organizationAccess
                            .organization.name,

                    plan:
                        organizationAccess
                            .organization.plan,

                    status:
                        organizationAccess
                            .organization.status
                },

                currentUser: {
                    userId:
                        organizationAccess
                            .user.id,

                    role:
                        organizationAccess
                            .organization.role,

                    status:
                        organizationAccess
                            .organization.memberStatus
                },

                members:
                    Array.isArray(members)
                        ? members
                        : []
            });

        } catch (error) {
            console.error(
                "Organization members GET error:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    "Unable to load your organization members."
            });
        }
    }
);

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

        const areaCode = String(
            req.query.area_code || ""
        ).trim();

        if (areaCode && !/^\d{3}$/.test(areaCode)) {
            return res.status(400).json({
                success: false,
                error: "Area code must be exactly 3 digits."
            });
        }

        /*
         * Get the customer's own reserved/assigned numbers
         * from Supabase.
         *
         * We use the server secret here because this endpoint
         * must be able to see the customer's reserved row.
         */
        const customerNumbersResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/phone_numbers` +
            `?select=id,phone_number,status,reserved_until,signalwire_number_id,purchased_at` +
            `&user_id=eq.${encodeURIComponent(auth.user.id)}` +
            `&status=in.(reserved,assigned)` +
            `&order=created_at.desc`,
            {
                method: "GET",
                headers: {
                    Authorization:
                        `Bearer ${SUPABASE_SECRET_KEY}`,
                    apikey:
                        SUPABASE_SECRET_KEY,
                    Accept:
                        "application/json"
                }
            }
        );

        const customerNumbers =
            await customerNumbersResponse.json();

        if (!customerNumbersResponse.ok) {
            console.error(
                "Customer phone numbers fetch error:",
                customerNumbers
            );

            return res.status(
                customerNumbersResponse.status
            ).json({
                success: false,
                error:
                    customerNumbers?.message ||
                    "Unable to load your phone number."
            });
        }

        /*
         * Remove expired reservations from the response.
         * Assigned numbers are always kept.
         */
        const now = Date.now();

        const customerNumberList =
            Array.isArray(customerNumbers)
                ? customerNumbers
                    .filter(number => {
                        if (number.status === "assigned") {
                            return true;
                        }

                        if (
                            number.status === "reserved" &&
                            number.reserved_until
                        ) {
                            return (
                                new Date(
                                    number.reserved_until
                                ).getTime() > now
                            );
                        }

                        return false;
                    })
                    .map(number => ({
                        phone_number:
                            number.phone_number,
                        status:
                            number.status,
                        reserved_until:
                            number.reserved_until || null,
                        signalwire_number_id:
                            number.signalwire_number_id ||
                            null,
                        purchased_at:
                            number.purchased_at ||
                            null
                    }))
                    .filter(
                        number =>
                            number.phone_number
                    )
                : [];

        /*
         * Get currently available numbers from SignalWire.
         */
        const signalWireAuth =
            Buffer.from(
                `${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`
            ).toString("base64");

        const response = await fetch(
            `https://${SIGNALWIRE_SPACE_NAME}.signalwire.com/api/relay/rest/phone_numbers/search?max_results=100${areaCode ? `&areacode=${areaCode}` : ""}`,
            {
                method: "GET",
                headers: {
                    Authorization:
                        `Basic ${signalWireAuth}`,
                    Accept:
                        "application/json"
                }
            }
        );

        const data =
            await response.json();

        if (!response.ok) {
            console.error(
                "Phone numbers fetch error:",
                data
            );

            return res.status(
                response.status
            ).json({
                success: false,
                error:
                    data?.message ||
                    "Unable to load phone numbers."
            });
        }

        const signalWireNumbers =
            Array.isArray(data)
                ? data
                : Array.isArray(data?.data)
                    ? data.data
                    : [];

        const availableNumbers =
            signalWireNumbers
                .map(number => ({
                    phone_number:
                        number.phone_number ||
                        number.number ||
                        number.e164,
                    status:
                        "available"
                }))
                .filter(
                    number =>
                        number.phone_number
                );

        /*
         * Prevent the customer's reserved/assigned number
         * from appearing again as an available number.
         */
        const customerPhoneSet =
            new Set(
                customerNumberList.map(
                    number =>
                        number.phone_number
                )
            );

        const filteredAvailableNumbers =
            availableNumbers.filter(
                number =>
                    !customerPhoneSet.has(
                        number.phone_number
                    )
            );

        /*
         * Customer's own number comes first.
         * SignalWire's available numbers come after it.
         */
        return res.json({
            success: true,
            numbers: [
                ...customerNumberList,
                ...filteredAvailableNumbers
            ]
        });

    } catch (error) {
        console.error(
            "Phone numbers GET error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Unable to load phone numbers."
        });
    }
});
// =========================================================
// DIALEAZE BILLING - PROVISION ACCOUNT AFTER PAYMENT
// =========================================================

app.post("/api/billing/provision", async (req, res) => {
    let paymentCode = null;
    let provisioningStarted = false;
    let purchasedSignalWireNumberId = null;
    let createdSignalWireSubscriberId = null;

    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        paymentCode =
            String(req.body?.code || "")
                .trim()
                .toUpperCase();

        if (!paymentCode) {
            return res.status(400).json({
                success: false,
                error: "Payment code is required."
            });
        }

        if (
            !SUPABASE_URL ||
            !SUPABASE_SECRET_KEY ||
            !SIGNALWIRE_SPACE_NAME ||
            !SIGNALWIRE_PROJECT_ID ||
            !SIGNALWIRE_API_TOKEN
        ) {
            console.error(
                "❌ Provisioning configuration is missing."
            );

            return res.status(500).json({
                success: false,
                error: "Provisioning configuration is missing on the server."
            });
        }

        const customerEmail =
            String(auth.user?.email || "").trim();

        if (!customerEmail) {
            return res.status(400).json({
                success: false,
                error:
                    "Your Dialeaze account does not have an email address."
            });
        }

        console.log(
            "🚀 Starting Dialeaze provisioning:",
            {
                userId: auth.user.id,
                email: customerEmail,
                paymentCode
            }
        );


        // =====================================================
        // STEP 1: LOCK PAYMENT + RESERVED PHONE NUMBER
        // =====================================================

        const beginResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/begin_dialeaze_provisioning`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    apikey: SUPABASE_SECRET_KEY,
                    Authorization:
                        `Bearer ${SUPABASE_SECRET_KEY}`
                },
                body: JSON.stringify({
                    p_code: paymentCode,
                    p_user_id: auth.user.id
                })
            }
        );

        const beginData = await beginResponse.json();

        if (!beginResponse.ok) {
            console.error(
                "❌ Begin provisioning RPC error:",
                beginData
            );

            return res.status(500).json({
                success: false,
                error:
                    beginData?.message ||
                    beginData?.error ||
                    "Unable to begin account provisioning."
            });
        }

        if (!beginData?.success) {
            return res.status(400).json({
                success: false,
                error:
                    beginData?.error ||
                    "Payment verification could not begin."
            });
        }

        provisioningStarted = true;

        const reservedPhoneNumber =
            String(beginData.phone_number || "").trim();

        if (!reservedPhoneNumber) {
            throw new Error(
                "Provisioning did not return a reserved phone number."
            );
        }

        console.log(
            "📌 Provisioning locked payment and phone reservation:",
            {
                userId: auth.user.id,
                phoneNumber: reservedPhoneNumber,
                plan: beginData.plan
            }
        );


        // =====================================================
        // SIGNALWIRE AUTH
        // =====================================================

        const signalWireAuth = Buffer.from(
            `${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`
        ).toString("base64");


        // =====================================================
        // STEP 2: PURCHASE THE RESERVED PHONE NUMBER
        // =====================================================

        console.log(
            "📞 Purchasing SignalWire phone number:",
            reservedPhoneNumber
        );

        const purchaseResponse = await fetch(
            `https://${SIGNALWIRE_SPACE_NAME}.signalwire.com/api/relay/rest/phone_numbers`,
            {
                method: "POST",
                headers: {
                    Authorization:
                        `Basic ${signalWireAuth}`,
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({
                    number: reservedPhoneNumber
                })
            }
        );

        const purchaseData =
            await purchaseResponse.json();

        if (!purchaseResponse.ok) {
            console.error(
                "❌ SignalWire phone number purchase failed:",
                purchaseData
            );

            throw new Error(
                purchaseData?.message ||
                purchaseData?.error ||
                "SignalWire could not purchase the reserved phone number."
            );
        }

        purchasedSignalWireNumberId =
            purchaseData?.id || null;

        if (!purchasedSignalWireNumberId) {
            throw new Error(
                "SignalWire purchased the number but did not return a phone number ID."
            );
        }

        console.log(
            "✅ SignalWire phone number purchased:",
            {
                id: purchasedSignalWireNumberId,
                number:
                    purchaseData?.number ||
                    reservedPhoneNumber
            }
        );


        // =====================================================
        // STEP 3: CREATE SIGNALWIRE SUBSCRIBER
        // =====================================================

        console.log(
            "👤 Creating SignalWire Subscriber:",
            customerEmail
        );

        const subscriberResponse = await fetch(
            `https://${SIGNALWIRE_SPACE_NAME}.signalwire.com/api/fabric/resources/subscribers`,
            {
                method: "POST",
                headers: {
                    Authorization:
                        `Basic ${signalWireAuth}`,
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({
                    email: customerEmail
                })
            }
        );

        const subscriberData =
            await subscriberResponse.json();

        if (!subscriberResponse.ok) {
            console.error(
                "❌ SignalWire Subscriber creation failed:",
                subscriberData
            );

            throw new Error(
                subscriberData?.message ||
                subscriberData?.error ||
                "SignalWire could not create the Subscriber."
            );
        }

        createdSignalWireSubscriberId =
            subscriberData?.subscriber?.id ||
            subscriberData?.subscriber_id ||
            subscriberData?.id ||
            null;

        if (!createdSignalWireSubscriberId) {
            throw new Error(
                "SignalWire created the Subscriber but did not return its ID."
            );
        }

        console.log(
            "✅ SignalWire Subscriber created:",
            {
                subscriberId:
                    createdSignalWireSubscriberId
            }
        );


        // =====================================================
        // STEP 4: FINALIZE SUPABASE PROVISIONING
        // =====================================================

        const finalizeResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/finalize_dialeaze_provisioning`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    apikey: SUPABASE_SECRET_KEY,
                    Authorization:
                        `Bearer ${SUPABASE_SECRET_KEY}`
                },
                body: JSON.stringify({
                    p_code: paymentCode,
                    p_user_id: auth.user.id,
                    p_phone_number:
                        reservedPhoneNumber,
                    p_signalwire_number_id:
                        purchasedSignalWireNumberId,
                    p_signalwire_subscriber_id:
                        createdSignalWireSubscriberId
                })
            }
        );

        const finalizeData =
            await finalizeResponse.json();

        if (!finalizeResponse.ok) {
            console.error(
                "❌ Finalize provisioning RPC error:",
                finalizeData
            );

            throw new Error(
                finalizeData?.message ||
                finalizeData?.error ||
                "Unable to finalize Dialeaze provisioning."
            );
        }

        if (!finalizeData?.success) {
            throw new Error(
                finalizeData?.error ||
                "Dialeaze provisioning could not be finalized."
            );
        }


        // =====================================================
        // SUCCESS
        // =====================================================

        provisioningStarted = false;

        console.log(
            "🎉 DIALEAZE PROVISIONING COMPLETE:",
            {
                userId: auth.user.id,
                phoneNumber: reservedPhoneNumber,
                subscriberId:
                    createdSignalWireSubscriberId,
                signalWireNumberId:
                    purchasedSignalWireNumberId
            }
        );

        return res.json({
            success: true,
            message:
                "Your Dialeaze account has been successfully provisioned.",
            plan: finalizeData.plan,
            status: finalizeData.status,
            phoneNumber:
                finalizeData.phone_number ||
                reservedPhoneNumber,
            signalwireSubscriberId:
                createdSignalWireSubscriberId,
            signalwireNumberId:
                purchasedSignalWireNumberId
        });


    } catch (error) {

        console.error(
            "❌ Dialeaze provisioning failed:",
            error
        );


        // =====================================================
        // ROLLBACK SIGNALWIRE SUBSCRIBER
        // =====================================================

        if (createdSignalWireSubscriberId) {
            try {

                const deleteSubscriberResponse =
                    await fetch(
                        `https://${SIGNALWIRE_SPACE_NAME}.signalwire.com/api/fabric/resources/subscribers/${encodeURIComponent(
                            createdSignalWireSubscriberId
                        )}`,
                        {
                            method: "DELETE",
                            headers: {
                                Authorization:
                                    `Basic ${Buffer.from(
                                        `${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`
                                    ).toString("base64")}`,
                                Accept: "application/json"
                            }
                        }
                    );

                if (
                    deleteSubscriberResponse.ok ||
                    deleteSubscriberResponse.status === 204
                ) {
                    console.log(
                        "↩️ SignalWire Subscriber rolled back:",
                        createdSignalWireSubscriberId
                    );
                } else {
                    const rollbackData =
                        await deleteSubscriberResponse
                            .text();

                    console.error(
                        "❌ Failed to roll back SignalWire Subscriber:",
                        rollbackData
                    );
                }

            } catch (rollbackError) {
                console.error(
                    "❌ Subscriber rollback exception:",
                    rollbackError
                );
            }
        }


        // =====================================================
        // ROLLBACK SIGNALWIRE PHONE NUMBER
        // =====================================================

        if (purchasedSignalWireNumberId) {
            try {

                const releaseNumberResponse =
                    await fetch(
                        `https://${SIGNALWIRE_SPACE_NAME}.signalwire.com/api/relay/rest/phone_numbers/${encodeURIComponent(
                            purchasedSignalWireNumberId
                        )}`,
                        {
                            method: "DELETE",
                            headers: {
                                Authorization:
                                    `Basic ${Buffer.from(
                                        `${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`
                                    ).toString("base64")}`,
                                Accept: "application/json"
                            }
                        }
                    );

                if (
                    releaseNumberResponse.ok ||
                    releaseNumberResponse.status === 204
                ) {
                    console.log(
                        "↩️ SignalWire phone number rolled back:",
                        purchasedSignalWireNumberId
                    );
                } else {
                    const rollbackData =
                        await releaseNumberResponse
                            .text();

                    console.error(
                        "❌ Failed to release SignalWire phone number:",
                        rollbackData
                    );
                }

            } catch (rollbackError) {
                console.error(
                    "❌ Phone number rollback exception:",
                    rollbackError
                );
            }
        }


        // =====================================================
        // ROLLBACK SUPABASE PAYMENT STATE
        // =====================================================

        if (provisioningStarted && paymentCode) {
            try {

                const cancelResponse =
                    await fetch(
                        `${SUPABASE_URL}/rest/v1/rpc/cancel_dialeaze_provisioning`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                                apikey:
                                    SUPABASE_SECRET_KEY,
                                Authorization:
                                    `Bearer ${SUPABASE_SECRET_KEY}`
                            },
                            body: JSON.stringify({
                                p_code: paymentCode,
                                p_user_id: auth?.user?.id
                            })
                        }
                    );

                const cancelData =
                    await cancelResponse.json();

                console.log(
                    "↩️ Provisioning payment rollback:",
                    cancelData
                );

            } catch (rollbackError) {
                console.error(
                    "❌ Payment rollback exception:",
                    rollbackError
                );
            }
        }


        return res.status(500).json({
            success: false,
            error:
                "Dialeaze provisioning could not be completed. No calling access was activated."
        });
    }
});
// =========================================================
// DIALEAZE BILLING - REDEEM PAYMENT CODE
// =========================================================

app.post("/api/billing/redeem-code", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const code =
            String(req.body?.code || "")
                .trim()
                .toUpperCase();

        if (!code) {
            return res.status(400).json({
                success: false,
                error: "Payment code is required."
            });
        }

        if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
            console.error(
                "❌ Billing: Supabase server configuration is missing."
            );

            return res.status(500).json({
                success: false,
                error: "Billing configuration is missing on the server."
            });
        }

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/redeem_dialeaze_payment_code`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    apikey: SUPABASE_SECRET_KEY,
                    Authorization:
                        `Bearer ${SUPABASE_SECRET_KEY}`
                },
                body: JSON.stringify({
                    p_code: code,
                    p_user_id: auth.user.id
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "❌ Payment code RPC error:",
                data
            );

            return res.status(500).json({
                success: false,
                error:
                    data?.message ||
                    data?.error ||
                    "Unable to verify payment code."
            });
        }

        if (!data || data.success !== true) {
            return res.status(400).json({
                success: false,
                error:
                    data?.error ||
                    "Invalid or unavailable payment code."
            });
        }

        console.log(
            "💳 Dialeaze payment code redeemed successfully:",
            {
                userId: auth.user.id,
                plan: data.plan,
                status: data.status
            }
        );

        return res.json({
            success: true,
            message: "Payment verified successfully.",
            plan: data.plan,
            status: data.status
        });

    } catch (error) {
        console.error(
            "❌ Payment code redemption error:",
            error
        );

        return res.status(500).json({
            success: false,
            error: "Unable to verify payment code."
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
// TEMPORARY MESSAGE STORAGE
// =========================================================

const messages = [];

// =========================================================
// SEND SMS - SIGNALWIRE
// =========================================================

app.post("/api/messages/send", async (req, res) => {
    try {

        const auth =
            await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const to =
            String(
                req.body?.to ||
                ""
            ).trim();

        const text =
            String(
                req.body?.text ||
                ""
            ).trim();

        if (!to) {
            return res.status(400).json({
                success: false,
                error:
                    "Recipient phone number is required."
            });
        }

        if (!text) {
            return res.status(400).json({
                success: false,
                error:
                    "Message text is required."
            });
        }

        // =====================================================
        // GET THIS USER'S ASSIGNED DIALEAZE PHONE NUMBER
        // =====================================================

        const phoneNumberResponse =
            await fetch(
                `${SUPABASE_URL}/rest/v1/phone_numbers` +
                `?user_id=eq.${encodeURIComponent(auth.user.id)}` +
                `&status=eq.assigned` +
                `&select=phone_number` +
                `&limit=1`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${SUPABASE_SECRET_KEY}`,
                        apikey:
                            SUPABASE_SECRET_KEY,
                        Accept:
                            "application/json"
                    }
                }
            );

        const phoneNumberData =
            await phoneNumberResponse.json();

        if (
            !phoneNumberResponse.ok ||
            !Array.isArray(phoneNumberData) ||
            !phoneNumberData.length
        ) {
            return res.status(404).json({
                success: false,
                error:
                    "Your Dialeaze phone number could not be found."
            });
        }

        const senderNumber =
            phoneNumberData[0].phone_number;

        if (!senderNumber) {
            return res.status(404).json({
                success: false,
                error:
                    "Your Dialeaze phone number is unavailable."
            });
        }

        // =====================================================
        // SEND THROUGH SIGNALWIRE
        // =====================================================

        const signalWireAuth =
            Buffer.from(
                `${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`
            ).toString("base64");

        const signalWireResponse =
            await fetch(
                `https://${SIGNALWIRE_SPACE_NAME}.signalwire.com/api/messaging/messages`,
                {
                    method: "POST",

                    headers: {
                        Authorization:
                            `Basic ${signalWireAuth}`,
                        "Content-Type":
                            "application/json",
                        Accept:
                            "application/json"
                    },

                    body: JSON.stringify({
                        from:
                            senderNumber,

                        to:
                            to,

                        body:
                            text
                    })
                }
            );

        const signalWireData =
            await signalWireResponse.json();

        if (!signalWireResponse.ok) {

            console.error(
                "❌ SignalWire SMS send error:",
                signalWireData
            );

            return res.status(
    signalWireResponse.status
).json({
    success: false,
    error:
        signalWireData?.message ||
        signalWireData?.error ||
        signalWireData?.error_message ||
        "Unable to send SMS through SignalWire.",
    signalWireError:
        signalWireData
});
        }

        // =====================================================
        // SAVE OUTBOUND MESSAGE TO SUPABASE
        // =====================================================

        const messageRecord = {
            user_id:
                auth.user.id,

            provider_message_id:
                signalWireData?.id ||
                signalWireData?.message_id ||
                null,

            from_number:
                signalWireData?.from ||
                senderNumber,

            to_number:
                signalWireData?.to ||
                to,

            body:
                text,

            direction:
                "outbound",

            status:
                signalWireData?.status ||
                "queued",

            is_read:
                true
        };

        const saveResponse =
            await fetch(
                `${SUPABASE_URL}/rest/v1/messages`,
                {
                    method: "POST",

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
                        JSON.stringify(
                            messageRecord
                        )
                }
            );

        const savedMessage =
            await saveResponse.json();

        if (!saveResponse.ok) {

            console.error(
                "❌ Failed to save outbound SMS:",
                savedMessage
            );

            return res.status(500).json({
                success: false,
                error:
                    "Message was sent, but could not be saved to your message history."
            });
        }

        console.log(
            "✅ SignalWire SMS sent and saved:",
            {
                from: senderNumber,
                to: to
            }
        );

        return res.json({
            success: true,

            message: {
                id:
                    savedMessage?.[0]?.id ||
                    null,

                providerMessageId:
                    messageRecord.provider_message_id,

                from:
                    messageRecord.from_number,

                to:
                    messageRecord.to_number,

                text:
                    messageRecord.body,

                direction:
                    "outbound",

                status:
                    messageRecord.status,

                createdAt:
                    savedMessage?.[0]?.created_at ||
                    new Date().toISOString(),

                isRead:
                    true
            }
        });

    } catch (error) {

        console.error(
            "❌ SMS sending error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                error?.message ||
                "Unable to send message."
        });
    }
});

// =========================================================
// MARK MESSAGES AS READ - SUPABASE
// =========================================================

app.post("/api/messages/read", async (req, res) => {
    try {

        const auth =
            await authenticateRequest(req);

        if (!auth.success) {
            return res.status(
                auth.status
            ).json({
                success: false,
                error: auth.error
            });
        }

        const phone =
            String(
                req.body?.phone ||
                ""
            ).trim();

        if (!phone) {
            return res.status(400).json({
                success: false,
                error:
                    "Phone number is required."
            });
        }

        // -------------------------------------------------
        // Get the logged-in customer's Dialeaze number
        // -------------------------------------------------

        const phoneNumberResponse =
            await fetch(
                `${SUPABASE_URL}/rest/v1/phone_numbers` +
                `?user_id=eq.${encodeURIComponent(auth.user.id)}` +
                `&status=eq.assigned` +
                `&select=phone_number` +
                `&limit=1`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${SUPABASE_SECRET_KEY}`,
                        apikey:
                            SUPABASE_SECRET_KEY,
                        Accept:
                            "application/json"
                    }
                }
            );

        const phoneNumberData =
            await phoneNumberResponse.json();

        if (
            !phoneNumberResponse.ok ||
            !Array.isArray(
                phoneNumberData
            ) ||
            !phoneNumberData.length
        ) {
            return res.status(404).json({
                success: false,
                error:
                    "Your Dialeaze phone number could not be found."
            });
        }

        const customerPhone =
            phoneNumberData[0].phone_number;

        // -------------------------------------------------
        // Mark inbound messages from this contact as read
        // -------------------------------------------------

        const updateUrl =
            `${SUPABASE_URL}/rest/v1/messages` +
            `?user_id=eq.${encodeURIComponent(auth.user.id)}` +
            `&direction=eq.inbound` +
            `&from_number=eq.${encodeURIComponent(phone)}` +
            `&to_number=eq.${encodeURIComponent(customerPhone)}` +
            `&is_read=eq.false`;

        const updateResponse =
            await fetch(
                updateUrl,
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
                        is_read: true,
                        updated_at:
                            new Date().toISOString()
                    })
                }
            );

        const updateData =
            await updateResponse.json();

        if (!updateResponse.ok) {

            console.error(
                "Mark messages read Supabase error:",
                updateData
            );

            return res.status(
                updateResponse.status
            ).json({
                success: false,
                error:
                    updateData?.message ||
                    "Unable to mark messages as read."
            });
        }

        return res.json({
            success: true,
            updated:
                Array.isArray(updateData)
                    ? updateData.length
                    : 0
        });

    } catch (error) {

        console.error(
            "Mark messages read error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                error?.message ||
                "Unable to mark messages as read."
        });
    }
});
// =========================================================
// GET MESSAGES - SUPABASE
// =========================================================
// =========================================================
// DIALEAZE CONTACTS API
// =========================================================

// ---------------------------------------------------------
// GET CONTACTS
// ---------------------------------------------------------

app.get("/api/contacts", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const userId = auth.user.id;

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/contacts` +
            `?user_id=eq.${encodeURIComponent(userId)}` +
            `&select=id,name,phone_number,email,company,notes,created_at,updated_at` +
            `&order=name.asc`,
            {
                method: "GET",
                headers: {
                    Authorization:
                        `Bearer ${SUPABASE_SECRET_KEY}`,
                    apikey:
                        SUPABASE_SECRET_KEY,
                    Accept:
                        "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "❌ Failed to load contacts:",
                data
            );

            return res.status(500).json({
                success: false,
                error: "Unable to load your contacts."
            });
        }

        return res.json({
            success: true,
            contacts:
                Array.isArray(data)
                    ? data
                    : []
        });

    } catch (error) {
        console.error(
            "❌ Get contacts error:",
            error
        );

        return res.status(500).json({
            success: false,
            error: "Unable to load your contacts."
        });
    }
});


// ---------------------------------------------------------
// CREATE CONTACT
// ---------------------------------------------------------

app.post("/api/contacts", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const userId = auth.user.id;

        const name =
            String(req.body?.name || "").trim();

        const phoneNumber =
            String(
                req.body?.phone_number || ""
            ).trim();

        const email =
            String(
                req.body?.email || ""
            ).trim();

        const company =
            String(
                req.body?.company || ""
            ).trim();

        const notes =
            String(
                req.body?.notes || ""
            ).trim();

        if (!name) {
            return res.status(400).json({
                success: false,
                error: "Contact name is required."
            });
        }

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error:
                    "Contact phone number is required."
            });
        }

        if (name.length > 150) {
            return res.status(400).json({
                success: false,
                error:
                    "Contact name is too long."
            });
        }

        if (phoneNumber.length > 30) {
            return res.status(400).json({
                success: false,
                error:
                    "Phone number is too long."
            });
        }

        if (email.length > 255) {
            return res.status(400).json({
                success: false,
                error:
                    "Email address is too long."
            });
        }

        if (company.length > 150) {
            return res.status(400).json({
                success: false,
                error:
                    "Company name is too long."
            });
        }

        if (notes.length > 5000) {
            return res.status(400).json({
                success: false,
                error:
                    "Notes are too long."
            });
        }

        const contactRecord = {
            user_id: userId,
            name: name,
            phone_number: phoneNumber,
            email: email || null,
            company: company || null,
            notes: notes || null
        };

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/contacts`,
            {
                method: "POST",
                headers: {
                    Authorization:
                        `Bearer ${SUPABASE_SECRET_KEY}`,
                    apikey:
                        SUPABASE_SECRET_KEY,
                    "Content-Type":
                        "application/json",
                    Accept:
                        "application/json",
                    Prefer:
                        "return=representation"
                },
                body:
                    JSON.stringify(
                        contactRecord
                    )
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "❌ Failed to create contact:",
                data
            );

            return res.status(500).json({
                success: false,
                error:
                    "Unable to create contact."
            });
        }

        return res.status(201).json({
            success: true,
            contact:
                Array.isArray(data)
                    ? data[0]
                    : data
        });

    } catch (error) {
        console.error(
            "❌ Create contact error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Unable to create contact."
        });
    }
});


// ---------------------------------------------------------
// UPDATE CONTACT
// ---------------------------------------------------------

app.patch("/api/contacts/:id", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const userId = auth.user.id;
        const contactId =
            String(req.params.id || "").trim();

        if (!contactId) {
            return res.status(400).json({
                success: false,
                error: "Contact ID is required."
            });
        }

        const updateData = {};

        if (
            Object.prototype.hasOwnProperty.call(
                req.body || {},
                "name"
            )
        ) {
            const name =
                String(
                    req.body.name || ""
                ).trim();

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Contact name cannot be empty."
                });
            }

            if (name.length > 150) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Contact name is too long."
                });
            }

            updateData.name = name;
        }

        if (
            Object.prototype.hasOwnProperty.call(
                req.body || {},
                "phone_number"
            )
        ) {
            const phoneNumber =
                String(
                    req.body.phone_number || ""
                ).trim();

            if (!phoneNumber) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Contact phone number cannot be empty."
                });
            }

            if (phoneNumber.length > 30) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Phone number is too long."
                });
            }

            updateData.phone_number =
                phoneNumber;
        }

        if (
            Object.prototype.hasOwnProperty.call(
                req.body || {},
                "email"
            )
        ) {
            const email =
                String(
                    req.body.email || ""
                ).trim();

            if (email.length > 255) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Email address is too long."
                });
            }

            updateData.email =
                email || null;
        }

        if (
            Object.prototype.hasOwnProperty.call(
                req.body || {},
                "company"
            )
        ) {
            const company =
                String(
                    req.body.company || ""
                ).trim();

            if (company.length > 150) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Company name is too long."
                });
            }

            updateData.company =
                company || null;
        }

        if (
            Object.prototype.hasOwnProperty.call(
                req.body || {},
                "notes"
            )
        ) {
            const notes =
                String(
                    req.body.notes || ""
                ).trim();

            if (notes.length > 5000) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Notes are too long."
                });
            }

            updateData.notes =
                notes || null;
        }

        if (
            Object.keys(updateData).length === 0
        ) {
            return res.status(400).json({
                success: false,
                error:
                    "No contact changes were provided."
            });
        }

        updateData.updated_at =
            new Date().toISOString();

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/contacts` +
            `?id=eq.${encodeURIComponent(contactId)}` +
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
                    Accept:
                        "application/json",
                    Prefer:
                        "return=representation"
                },
                body:
                    JSON.stringify(updateData)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "❌ Failed to update contact:",
                data
            );

            return res.status(500).json({
                success: false,
                error:
                    "Unable to update contact."
            });
        }

        if (
            !Array.isArray(data) ||
            data.length === 0
        ) {
            return res.status(404).json({
                success: false,
                error:
                    "Contact not found."
            });
        }

        return res.json({
            success: true,
            contact: data[0]
        });

    } catch (error) {
        console.error(
            "❌ Update contact error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Unable to update contact."
        });
    }
});


// ---------------------------------------------------------
// DELETE CONTACT
// ---------------------------------------------------------

app.delete("/api/contacts/:id", async (req, res) => {
    try {
        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const userId = auth.user.id;

        const contactId =
            String(req.params.id || "").trim();

        if (!contactId) {
            return res.status(400).json({
                success: false,
                error:
                    "Contact ID is required."
            });
        }

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/contacts` +
            `?id=eq.${encodeURIComponent(contactId)}` +
            `&user_id=eq.${encodeURIComponent(userId)}`,
            {
                method: "DELETE",
                headers: {
                    Authorization:
                        `Bearer ${SUPABASE_SECRET_KEY}`,
                    apikey:
                        SUPABASE_SECRET_KEY,
                    Accept:
                        "application/json",
                    Prefer:
                        "return=representation"
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "❌ Failed to delete contact:",
                data
            );

            return res.status(500).json({
                success: false,
                error:
                    "Unable to delete contact."
            });
        }

        if (
            !Array.isArray(data) ||
            data.length === 0
        ) {
            return res.status(404).json({
                success: false,
                error:
                    "Contact not found."
            });
        }

        return res.json({
            success: true,
            message:
                "Contact deleted successfully."
        });

    } catch (error) {
        console.error(
            "❌ Delete contact error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Unable to delete contact."
        });
    }
});

app.get("/api/messages", async (req, res) => {
    try {

        const auth = await authenticateRequest(req);

        if (!auth.success) {
            return res.status(auth.status).json({
                success: false,
                error: auth.error
            });
        }

        const phone =
            String(req.query.phone || "").trim();

        let url =
            `${SUPABASE_URL}/rest/v1/messages` +
            `?user_id=eq.${encodeURIComponent(auth.user.id)}` +
            `&order=created_at.asc`;

        const response = await fetch(
            url,
            {
                method: "GET",

                headers: {
                    Authorization:
                        `Bearer ${SUPABASE_SECRET_KEY}`,

                    apikey:
                        SUPABASE_SECRET_KEY,

                    Accept:
                        "application/json"
                }
            }
        );

        const data =
            await response.json();

        if (!response.ok) {

            console.error(
                "Get messages Supabase error:",
                data
            );

            return res.status(
                response.status
            ).json({
                success: false,
                error:
                    data?.message ||
                    "Unable to load messages."
            });
        }

        let userMessages =
            Array.isArray(data)
                ? data
                : [];

        if (phone) {

            userMessages =
                userMessages.filter(
                    message =>
                        message.from_number === phone ||
                        message.to_number === phone
                );

        }

        const formattedMessages =
            userMessages.map(
                message => ({
                    id:
                        message.id,

                    userId:
                        message.user_id,

                    providerMessageId:
                        message.provider_message_id,

                    from:
                        message.from_number,

                    to:
                        message.to_number,

                    text:
                        message.body,

                    direction:
                        message.direction,

                    status:
                        message.status,

                    createdAt:
    message.created_at,
updatedAt:
    message.updated_at,
isRead:
    message.is_read
                })
            );

        return res.json({
            success: true,
            messages: formattedMessages
        });

    } catch (error) {

        console.error(
            "Get messages error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Unable to load messages."
        });

    }
});

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
// START SIGNALWIRE CALL RECORDING
// =========================================================

app.post("/api/outbound-call/record", async (req, res) => {
    try {
        const user = await authenticateRequest(req);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized."
            });
        }

        const {
            callId,
            providerCallId,
            usageId
        } = req.body || {};

        // Accept either field name so we do not have to
        // immediately change the existing frontend.
        const activeCallId =
            callId ||
            providerCallId;

        if (!activeCallId) {
            return res.status(400).json({
                success: false,
                error:
                    "Missing SignalWire call ID."
            });
        }

        if (
            !SIGNALWIRE_SPACE_NAME ||
            !SIGNALWIRE_PROJECT_ID ||
            !SIGNALWIRE_API_TOKEN
        ) {
            console.error(
                "❌ Missing SignalWire Calling API configuration."
            );

            return res.status(500).json({
                success: false,
                error:
                    "SignalWire recording configuration is incomplete."
            });
        }

        const basicAuth =
            Buffer
                .from(
                    `${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`
                )
                .toString("base64");

        const response =
            await fetch(
                `https://${SIGNALWIRE_SPACE_NAME}.signalwire.com/api/calling/calls`,
                {
                    method: "POST",

                    headers: {
                        Authorization:
                            `Basic ${basicAuth}`,

                        "Content-Type":
                            "application/json",

                        Accept:
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            command:
                                "calling.record",

                            id:
                                activeCallId,

                            params: {
                                control_id:
                                    `dialeaze-record-${Date.now()}`,

                                audio: {
    format:
        "mp3",

    stereo:
        false,

    direction:
        "both",

    beep:
        false
},

                                status_url:
                                    "https://dialeaze.onrender.com/api/signalwire/recording-callback"
                            }
                        })
                }
            );

        const responseText =
            await response.text();

        let responseData = null;

        try {
            responseData =
                responseText
                    ? JSON.parse(responseText)
                    : null;
        } catch {
            responseData =
                responseText;
        }

        if (!response.ok) {
            console.error(
                "❌ SignalWire Calling API recording error:",
                response.status,
                responseData
            );

            return res.status(
                response.status
            ).json({
                success: false,
                error:
                    "SignalWire could not start recording.",
                signalwireStatus:
                    response.status,
                details:
                    responseData
            });
        }

        console.log(
            "🎙️ SignalWire recording started:",
            JSON.stringify(
                responseData,
                null,
                2
            )
        );

        return res.json({
            success: true,
            usageId:
                usageId || null,
            callId:
                activeCallId,
            signalwire:
                responseData
        });

    } catch (error) {
        console.error(
            "❌ Start recording error:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Could not start call recording."
        });
    }
});

// =========================================================
// SIGNALWIRE RECORDING CALLBACK
// =========================================================

app.post(
    "/api/signalwire/recording-callback",
    async (req, res) => {
        try {
            console.log(
                "🎙️ SIGNALWIRE RECORDING CALLBACK"
            );

            console.log(
                "Recording callback data:",
                JSON.stringify(
                    req.body,
                    null,
                    2
                )
            );

            const params =
                req.body?.params ||
                {};

            const eventType =
                req.body?.event_type ||
                "";

            const callId =
                params.call_id ||
                null;

            const state =
                String(
                    params.state ||
                    ""
                ).toLowerCase();

            const recordingId =
                params.recording_id ||
                null;

            const recordingUrl =
                params.url ||
                null;

            const duration =
                params.duration != null
                    ? Number(
                        params.duration
                    )
                    : null;

            console.log(
                "📞 Recording call ID:",
                callId
            );

            console.log(
                "📼 Recording state:",
                state
            );

            console.log(
                "📼 Recording ID:",
                recordingId
            );

            console.log(
                "📼 Recording URL:",
                recordingUrl
            );

            console.log(
                "⏱️ Recording duration:",
                duration
            );

            if (
                eventType &&
                eventType !==
                    "calling.call.record"
            ) {
                console.warn(
                    "⚠️ Unexpected recording event type:",
                    eventType
                );
            }

            if (!callId) {
                console.warn(
                    "⚠️ Recording callback missing call_id."
                );

                return res.status(400).json({
                    success: false,
                    error:
                        "Missing SignalWire call ID."
                });
            }

            /*
             * Find the Dialeaze call associated
             * with this SignalWire call.
             */
            const usageResponse =
                await fetch(
                    `${SUPABASE_URL}/rest/v1/customer_call_usage` +
                    `?provider_call_id=eq.${encodeURIComponent(
                        callId
                    )}` +
                    `&select=id,user_id`,
                    {
                        method:
                            "GET",

                        headers: {
                            Authorization:
                                `Bearer ${SUPABASE_SECRET_KEY}`,

                            apikey:
                                SUPABASE_SECRET_KEY,

                            Accept:
                                "application/json"
                        }
                    }
                );

            if (!usageResponse.ok) {
                const errorText =
                    await usageResponse.text();

                console.error(
                    "❌ Could not find call usage:",
                    usageResponse.status,
                    errorText
                );

                return res.sendStatus(200);
            }

            const usageRows =
                await usageResponse.json();

            const usage =
                Array.isArray(
                    usageRows
                )
                    ? usageRows[0]
                    : null;

            if (!usage) {
                console.warn(
                    "⚠️ No customer_call_usage row found for recording call:",
                    callId
                );

                /*
                 * Return 200 so SignalWire does
                 * not keep retrying a callback
                 * that we cannot associate.
                 */
                return res.sendStatus(200);
            }

            /*
             * The recording operation sends
             * multiple states:
             *
             * recording
             * paused
             * finished
             * no_input
             * error
             *
             * We only mark the recording as
             * completed once SignalWire gives
             * us the finished recording.
             */

            let recordingStatus =
                "processing";

            if (
                state === "finished"
            ) {
                recordingStatus =
                    "completed";
            } else if (
                state === "error"
            ) {
                recordingStatus =
                    "failed";
            }

            /*
             * Check whether a recording row
             * already exists for this call.
             */
            const existingResponse =
                await fetch(
                    `${SUPABASE_URL}/rest/v1/call_recordings` +
                    `?provider_call_id=eq.${encodeURIComponent(
                        callId
                    )}` +
                    `&select=id`,
                    {
                        method:
                            "GET",

                        headers: {
                            Authorization:
                                `Bearer ${SUPABASE_SECRET_KEY}`,

                            apikey:
                                SUPABASE_SECRET_KEY,

                            Accept:
                                "application/json"
                        }
                    }
                );

            if (!existingResponse.ok) {
                const errorText =
                    await existingResponse.text();

                console.error(
                    "❌ Could not check existing recording:",
                    existingResponse.status,
                    errorText
                );

                return res.sendStatus(200);
            }

            const existingRows =
                await existingResponse.json();

            const existing =
                Array.isArray(
                    existingRows
                )
                    ? existingRows[0]
                    : null;

            const recordingData = {
                user_id:
                    usage.user_id,

                usage_id:
                    usage.id,

                provider_call_id:
                    callId,

                recording_id:
                    recordingId,

                recording_url:
                    recordingUrl,

                duration_seconds:
                    Number.isFinite(
                        duration
                    )
                        ? Math.round(
                            duration
                        )
                        : null,

                status:
                    recordingStatus,

                updated_at:
                    new Date().toISOString()
            };

            if (existing?.id) {

                const updateResponse =
                    await fetch(
                        `${SUPABASE_URL}/rest/v1/call_recordings` +
                        `?id=eq.${encodeURIComponent(
                            existing.id
                        )}`,
                        {
                            method:
                                "PATCH",

                            headers: {
                                Authorization:
                                    `Bearer ${SUPABASE_SECRET_KEY}`,

                                apikey:
                                    SUPABASE_SECRET_KEY,

                                "Content-Type":
                                    "application/json",

                                Prefer:
                                    "return=minimal"
                            },

                            body:
                                JSON.stringify(
                                    recordingData
                                )
                        }
                    );

                if (!updateResponse.ok) {
                    const errorText =
                        await updateResponse.text();

                    console.error(
                        "❌ Failed to update call recording:",
                        updateResponse.status,
                        errorText
                    );

                    return res.sendStatus(200);
                }

            } else {

                recordingData.created_at =
                    new Date().toISOString();

                const insertResponse =
                    await fetch(
                        `${SUPABASE_URL}/rest/v1/call_recordings`,
                        {
                            method:
                                "POST",

                            headers: {
                                Authorization:
                                    `Bearer ${SUPABASE_SECRET_KEY}`,

                                apikey:
                                    SUPABASE_SECRET_KEY,

                                "Content-Type":
                                    "application/json",

                                Prefer:
                                    "return=minimal"
                            },

                            body:
                                JSON.stringify(
                                    recordingData
                                )
                        }
                    );

                if (!insertResponse.ok) {
                    const errorText =
                        await insertResponse.text();

                    console.error(
                        "❌ Failed to save call recording:",
                        insertResponse.status,
                        errorText
                    );

                    return res.sendStatus(200);
                }
            }

            console.log(
                "✅ Call recording saved:",
                {
                    callId,
                    recordingId,
                    state,
                    recordingStatus
                }
            );

            return res.sendStatus(200);

        } catch (error) {

            console.error(
                "❌ Recording callback error:",
                error
            );

            /*
             * Always acknowledge the webhook.
             * We don't want SignalWire repeatedly
             * retrying because of an internal
             * Dialeaze database error.
             */
            return res.sendStatus(200);
        }
    }
);
// =========================================================
// SIGNALWIRE VOICEMAIL RECORDING CALLBACK
// =========================================================

app.post(
    "/api/signalwire/voicemail-recording-callback",
    async (req, res) => {

        try {

            console.log(
                "📨 SIGNALWIRE VOICEMAIL RECORDING CALLBACK"
            );

            console.log(
                JSON.stringify(
                    req.body,
                    null,
                    2
                )
            );

            const params =
                req.body?.params ||
                {};

            const callId =
                params.call_id ||
                null;

            const state =
                String(
                    params.state ||
                    ""
                ).toLowerCase();

            const recording =
                params.record ||
                {};

            const recordingUrl =
                params.url ||
                recording.url ||
                null;

            const recordingId =
                params.recording_id ||
                recording.recording_id ||
                null;

            const duration =
                params.duration ??
                recording.duration ??
                null;

            if (!callId) {

                console.warn(
                    "⚠️ Voicemail callback missing call ID."
                );

                return res.sendStatus(204);
            }

            console.log(
                "🎙️ Voicemail recording event:",
                {
                    callId,
                    state,
                    recordingId,
                    recordingUrl,
                    duration
                }
            );

            // -----------------------------------------
            // Recording successfully completed
            // -----------------------------------------

            if (
                state === "finished" ||
                state === "no_input"
            ) {

                const updateData = {

                    status:
                        state === "no_input"
                            ? "no_input"
                            : "completed",

                    recording_id:
                        recordingId,

                    recording_url:
                        recordingUrl,

                    duration_seconds:
                        duration !== null
                            ? Math.floor(
                                Number(duration)
                            )
                            : null,

                    updated_at:
                        new Date().toISOString()

                };

                const updateResponse =
                    await fetch(
                        `${SUPABASE_URL}/rest/v1/voicemails` +
                        `?provider_call_id=eq.${encodeURIComponent(callId)}`,

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
                                JSON.stringify(
                                    updateData
                                )
                        }
                    );

                const updateResult =
                    await updateResponse.json();

                if (!updateResponse.ok) {

                    console.error(
                        "❌ Failed to save voicemail recording:",
                        updateResult
                    );

                } else {

                    console.log(
                        "✅ Voicemail recording saved:",
                        updateResult
                    );

                }

            }

            // -----------------------------------------
            // Recording error
            // -----------------------------------------

            if (state === "error") {

                const updateResponse =
                    await fetch(
                        `${SUPABASE_URL}/rest/v1/voicemails` +
                        `?provider_call_id=eq.${encodeURIComponent(callId)}`,

                        {
                            method: "PATCH",

                            headers: {

                                Authorization:
                                    `Bearer ${SUPABASE_SECRET_KEY}`,

                                apikey:
                                    SUPABASE_SECRET_KEY,

                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    status:
                                        "failed",

                                    updated_at:
                                        new Date().toISOString()
                                })
                        }
                    );

                if (!updateResponse.ok) {

                    console.error(
                        "❌ Failed to mark voicemail as failed."
                    );

                }

            }

            return res.sendStatus(204);

        } catch (error) {

            console.error(
                "❌ Voicemail recording callback error:",
                error
            );

            // SignalWire callbacks should not be
            // repeatedly retried because our internal
            // processing failed.

            return res.sendStatus(204);
        }

    }
);
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

// =========================================================
// SIGNALWIRE RECORDING SWML
// =========================================================

app.post(
    "/api/signalwire/recording-swml",
    (req, res) => {

        console.log(
            "🎙️ SIGNALWIRE RECORDING SWML REQUEST"
        );

        console.log(
            "Recording SWML request:",
            JSON.stringify(
                req.body,
                null,
                2
            )
        );

        const usageId =
            req.query?.usageId ||
            null;

        const callId =
            req.body?.call?.call_id ||
            req.body?.params?.call_id ||
            null;

        const controlId =
            usageId
                ? `dialeaze-record-${usageId}`
                : `dialeaze-record-${callId || Date.now()}`;

        console.log(
            "🎙️ Recording SWML call ID:",
            callId
        );

        console.log(
            "🎙️ Recording SWML usage ID:",
            usageId
        );

        console.log(
            "🎙️ Recording SWML control ID:",
            controlId
        );

        return res.json({
            version: "1.0.0",
            sections: {
                main: [
                    {
                        record_call: {
                            control_id: controlId,
                            format: "mp3",
                            stereo: false,
                            direction: "both",
                            beep: false,
                            status_url:
                                "https://dialeaze.onrender.com/api/signalwire/recording-callback"
                        }
                    }
                ]
            }
        });
    }
);
// =========================================================
// SIGNALWIRE OUTBOUND SWML
// =========================================================

app.post("/api/signalwire/outbound-swml", (req, res) => {
    console.log("📞 SIGNALWIRE OUTBOUND SWML RECEIVED");
    console.log(
        "SWML outbound request:",
        JSON.stringify(req.body, null, 2)
    );

    const userVariables =
    req.body?.vars?.userVariables ||
    req.body?.vars?.user_variables ||
    req.body?.user_variables ||
    req.body?.userVariables ||
    req.body?.params?.user_variables ||
    req.body?.params?.userVariables ||
    {};

    const destination =
        userVariables.destination ||
        userVariables.destinationNumber ||
        null;

    const callerNumber =
    SIGNALWIRE_PHONE_NUMBER ||
    userVariables.callerNumber ||
    null;

    const usageId =
    userVariables.usageId ||
    userVariables.usage_id ||
    null;

    if (!destination) {
        console.error(
            "❌ OUTBOUND SWML: No destination received."
        );

        return res.status(400).json({
            success: false,
            error: "No outbound destination was provided."
        });
    }

    console.log(
        "📞 OUTBOUND SWML DESTINATION:",
        destination
    );

    console.log(
        "📞 OUTBOUND SWML CALLER ID:",
        callerNumber
    );

    return res.json({
    version: "1.0.0",
    sections: {
        main: [
            {
                connect: {
    from: callerNumber,
    to: destination,
    timeout: 30,
    confirm:
    `https://dialeaze.onrender.com/api/signalwire/recording-swml?usageId=${encodeURIComponent(
        usageId || ""
    )}`,
    call_state_events: [
        "created",
        "ringing",
        "answered",
        "ended"
    ],
    call_state_url:
        "https://dialeaze.onrender.com/api/signalwire/outbound-call-state",
    status_url:
        "https://dialeaze.onrender.com/api/signalwire/outbound-connect-status"
}
            },
            {
                hangup: {}
            }
        ]
    }
});
});


/// =========================================================
// SIGNALWIRE OUTBOUND CALL STATE
// =========================================================

// Supabase is the permanent source of truth for SignalWire
// PSTN call state.
//
// IMPORTANT:
// Do NOT use an in-memory Map here.
// SignalWire webhooks and browser polling must always see
// the same state even if Render restarts or requests are
// handled by different processes.

// ---------------------------------------------------------
// SAVE SIGNALWIRE CALL STATE
// ---------------------------------------------------------

async function saveSignalWireCallState({
    parentCallId,
    childCallId = null,
    state,
    reason = null
}) {
    if (!parentCallId || !state) {
        console.warn(
            "⚠️ Cannot save SignalWire state: missing call ID or state."
        );

        return null;
    }

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
        console.error(
            "❌ Supabase secret configuration missing."
        );

        return null;
    }

    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/store_signalwire_call_state`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    apikey:
                        SUPABASE_SECRET_KEY,

                    Authorization:
                        `Bearer ${SUPABASE_SECRET_KEY}`
                },

                body: JSON.stringify({
                    p_parent_call_id:
                        parentCallId,

                    p_child_call_id:
                        childCallId,

                    p_state:
                        state,

                    p_reason:
                        reason
                })
            }
        );

        const text =
            await response.text();

        if (!response.ok) {
            console.error(
                "❌ Supabase SignalWire state save failed:",
                response.status,
                text
            );

            return null;
        }

        let data = null;

        try {
            data =
                text
                    ? JSON.parse(text)
                    : null;
        } catch {
            data = text;
        }

        console.log(
            "💾 Supabase SignalWire state saved:",
            {
                parentCallId,
                childCallId,
                state,
                reason
            }
        );

        return data;

    } catch (error) {

        console.error(
            "❌ Error saving SignalWire call state:",
            error
        );

        return null;
    }
}


// =========================================================
// SIGNALWIRE OUTBOUND CALL STATE WEBHOOK
// =========================================================

app.post(
    "/api/signalwire/outbound-call-state",
    async (req, res) => {

        console.log(
            "📡 SIGNALWIRE OUTBOUND CALL STATE"
        );

        console.log(
            JSON.stringify(
                req.body,
                null,
                2
            )
        );

        const params =
            req.body?.params || {};

        const parentCallId =
            params.parent?.call_id ||
            params.call_id ||
            null;

        const childCallId =
            params.call_id ||
            null;

        const callState =
            String(
                params.call_state || ""
            ).toLowerCase();

        const endReason =
            params.end_reason ||
            null;

        if (
            parentCallId &&
            callState
        ) {

            await saveSignalWireCallState({
                parentCallId,
                childCallId,
                state: callState,
                reason: endReason
            });

            console.log(
                "📌 Stored SignalWire call state in Supabase:",
                {
                    parentCallId,
                    childCallId,
                    state: callState,
                    reason: endReason
                }
            );

        } else {

            console.warn(
                "⚠️ SignalWire call-state webhook missing call ID or state."
            );
        }

        return res.sendStatus(204);
    }
);


// =========================================================
// SIGNALWIRE OUTBOUND CONNECT STATUS WEBHOOK
// =========================================================

app.post(
    "/api/signalwire/outbound-connect-status",
    async (req, res) => {

        console.log(
            "📡 SIGNALWIRE OUTBOUND CONNECT STATUS"
        );

        console.log(
            JSON.stringify(
                req.body,
                null,
                2
            )
        );

        const params =
            req.body?.params || {};

        const callId =
            params.call_id ||
            null;

        const connectState =
            String(
                params.connect_state || ""
            ).toLowerCase();

        const failedReason =
            params.failed_reason ||
            null;

        if (
            callId &&
            connectState
        ) {

            const normalizedState =
                connectState === "failed"
                    ? "ended"
                    : connectState;

            await saveSignalWireCallState({
                parentCallId:
                    callId,

                childCallId:
                    null,

                state:
                    normalizedState,

                reason:
                    failedReason
            });

            console.log(
                "📌 Stored SignalWire connect state in Supabase:",
                {
                    callId,
                    state:
                        normalizedState,
                    reason:
                        failedReason
                }
            );

        } else {

            console.warn(
                "⚠️ SignalWire connect-status webhook missing call ID or state."
            );
        }

        return res.sendStatus(204);
    }
);


// =========================================================
// SIGNALWIRE OUTBOUND CALL STATE CHECK
// =========================================================

app.get(
    "/api/signalwire/outbound-call-state/:callId",
    async (req, res) => {

        const callId =
            req.params.callId;

        try {

            const response =
                await fetch(
                    `${SUPABASE_URL}/rest/v1/signalwire_call_states` +
                    `?parent_call_id=eq.${encodeURIComponent(callId)}` +
                    `&select=parent_call_id,child_call_id,state,reason,updated_at` +
                    `&order=updated_at.desc&limit=1`,
                    {
                        method: "GET",
                        headers: {
                            Authorization:
                                `Bearer ${SUPABASE_SECRET_KEY}`,
                            apikey:
                                SUPABASE_SECRET_KEY
                        }
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                console.error(
                    "❌ Failed to read SignalWire call state:",
                    data
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Unable to read call state."
                });
            }

            res.set(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, proxy-revalidate"
            );

            res.set(
                "Pragma",
                "no-cache"
            );

            res.set(
                "Expires",
                "0"
            );

            const providerState =
                data?.[0];

            if (!providerState) {

                return res.json({
                    success: true,
                    found: false
                });
            }

            return res.json({
                success: true,
                found: true,
                state:
                    providerState.state,
                reason:
                    providerState.reason || null,
                childCallId:
                    providerState.child_call_id || null,
                updatedAt:
                    providerState.updated_at
            });

        } catch (error) {

            console.error(
                "❌ SignalWire call-state GET error:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    "Unable to check call state."
            });
        }
    }
);

app.post("/api/signalwire/inbound-swml", (req, res) => {
    console.log("📞 SIGNALWIRE INBOUND CALL RECEIVED");

    console.log(
        "Inbound SWML request:",
        JSON.stringify(req.body, null, 2)
    );

    return res.json({
        version: "1.0.0",

        sections: {
            main: [
                {
                    connect: {
                        to: "/private/junaid-sabir",

                        timeout: 30,

                        answer_on_bridge: false,

                        call_state_events: [
                            "created",
                            "ringing",
                            "answered",
                            "ended"
                        ],

                        call_state_url:
                            "https://dialeaze.onrender.com/api/signalwire/inbound-call-state",

                        status_url:
                            "https://dialeaze.onrender.com/api/signalwire/inbound-connect-status",

                        result: [
                            {
                                when: "connect_result == 'failed'",

                                then: [
                                    {
                                        play: {
                                            url: "say: This is the Dialeaze voicemail. Please leave your message after the beep. Press pound when you are finished."
                                        }
                                    },

                                    {
    record: {
        beep: true,
        terminators: "#",
        initial_timeout: 5,
        end_silence_timeout: 5,
        max_length: 120,
        format: "mp3",

        status_url:
            "https://dialeaze.onrender.com/api/signalwire/voicemail-recording-callback"
    }
},

                                    {
                                        play: {
                                            url: "say: Thank you for your message. We will get back to you as soon as possible. Goodbye."
                                        }
                                    },

                                    {
                                        hangup: {}
                                    }
                                ]
                            },

                            {
                                else: [
                                    {
                                        hangup: {}
                                    }
                                ]
                            }
                        ]
                    }
                }
            ]
        }
    });
});

app.post("/api/signalwire/inbound-connect-status", (req, res) => {
    console.log("📡 SIGNALWIRE INBOUND CONNECT STATUS");

    console.log(
        JSON.stringify(req.body, null, 2)
    );

    return res.sendStatus(200);
});

app.post("/api/signalwire/voicemail-recording-callback", (req, res) => {
    console.log("🎙️ SIGNALWIRE VOICEMAIL RECORDING CALLBACK");

    console.log(
        "Voicemail recording payload:",
        JSON.stringify(req.body, null, 2)
    );

    const params = req.body?.params || {};

    console.log("📼 Voicemail recording state:", params.state);
    console.log("📼 Voicemail recording ID:", params.recording_id);
    console.log("📼 Voicemail recording URL:", params.url);
    console.log("📼 Voicemail duration:", params.duration);
    console.log("📞 Voicemail call ID:", params.call_id);

    return res.sendStatus(200);
});

// =========================================================
// SIGNALWIRE INBOUND CALL STATE WEBHOOK
// =========================================================

app.post(
    "/api/signalwire/inbound-call-state",
    async (req, res) => {

        try {

            console.log(
                "📡 SIGNALWIRE INBOUND CALL STATE"
            );

            console.log(
                JSON.stringify(
                    req.body,
                    null,
                    2
                )
            );

            const call =
                req.body?.call ||
                {};

            const params =
                req.body?.params ||
                {};

            const deviceParams =
                params.device?.params ||
                call.device?.params ||
                {};

            const callId =
                call.call_id ||
                params.call_id ||
                null;

            const parentCallId =
                params.parent?.call_id ||
                call.parent?.call_id ||
                null;

            const callState =
                call.call_state ||
                params.call_state ||
                null;

            const rawFrom =
                deviceParams.from ||
                call.from_number ||
                call.from ||
                null;

            const rawTo =
                deviceParams.to ||
                call.to_number ||
                call.to ||
                null;

            const fromNumber =
                rawFrom
                    ? String(rawFrom)
                        .replace(/^sip:/i, "")
                        .split("@")[0]
                    : null;

            const rawDestination =
                rawTo
                    ? String(rawTo)
                        .replace(/^sip:/i, "")
                    : null;

            /*
             * Example:
             *
             * sip:junaid-sabir@SPACE.call.signalwire.com;context=private
             *
             * becomes:
             *
             * /private/junaid-sabir
             */

            let privateAddress = null;

            if (rawDestination) {

                const destinationMatch =
                    rawDestination.match(
                        /^([^@]+)@[^;]+;context=([^;]+)$/i
                    );

                if (destinationMatch) {

                    const subscriberName =
                        destinationMatch[1];

                    const context =
                        destinationMatch[2];

                    privateAddress =
                        `/${context}/${subscriberName}`;

                }

            }

            if (!callId) {

                console.warn(
                    "⚠️ Inbound call-state missing call ID."
                );

                return res.sendStatus(204);
            }

            console.log(
                "📞 Parsed inbound destination:",
                {
                    rawDestination,
                    privateAddress
                }
            );

            // -----------------------------------------
            // Find the Dialeaze customer by the
            // SignalWire private Subscriber address.
            // -----------------------------------------

            let userId = null;

            let customerPhoneNumber = null;

            if (privateAddress) {

                const profileResponse =
                    await fetch(
                        `${SUPABASE_URL}/rest/v1/profiles` +
                        `?signalwire_private_address=eq.${encodeURIComponent(privateAddress)}` +
                        `&signalwire_provisioned=eq.true` +
                        `&select=id,phone_number`,

                        {
                            method: "GET",

                            headers: {
                                Authorization:
                                    `Bearer ${SUPABASE_SECRET_KEY}`,

                                apikey:
                                    SUPABASE_SECRET_KEY,

                                Accept:
                                    "application/json"
                            }
                        }
                    );

                const profileData =
                    await profileResponse.json();

                if (
                    profileResponse.ok &&
                    Array.isArray(profileData) &&
                    profileData.length > 0
                ) {

                    userId =
                        profileData[0].id;

                    customerPhoneNumber =
                        profileData[0].phone_number ||
                        null;

                } else if (!profileResponse.ok) {

                    console.error(
                        "❌ Failed to find Dialeaze profile:",
                        profileData
                    );

                }

            }

            console.log(
                "📞 Inbound call mapping:",
                {
                    callId,
                    parentCallId,
                    callState,
                    fromNumber,
                    toNumber:
                        customerPhoneNumber,
                    privateAddress,
                    userId
                }
            );

            // -----------------------------------------
            // Create voicemail placeholder.
            //
            // IMPORTANT:
            // SignalWire's recording callback uses
            // the parent call ID.
            // -----------------------------------------

            const voicemailCallId =
                parentCallId ||
                callId;

            if (
                userId &&
                callState === "created"
            ) {

                const existingResponse =
                    await fetch(
                        `${SUPABASE_URL}/rest/v1/voicemails` +
                        `?provider_call_id=eq.${encodeURIComponent(voicemailCallId)}` +
                        `&select=id`,

                        {
                            method: "GET",

                            headers: {
                                Authorization:
                                    `Bearer ${SUPABASE_SECRET_KEY}`,

                                apikey:
                                    SUPABASE_SECRET_KEY,

                                Accept:
                                    "application/json"
                            }
                        }
                    );

                const existingData =
                    await existingResponse.json();

                if (
                    existingResponse.ok &&
                    Array.isArray(existingData) &&
                    existingData.length === 0
                ) {

                    const insertResponse =
                        await fetch(
                            `${SUPABASE_URL}/rest/v1/voicemails`,

                            {
                                method: "POST",

                                headers: {
                                    Authorization:
                                        `Bearer ${SUPABASE_SECRET_KEY}`,

                                    apikey:
                                        SUPABASE_SECRET_KEY,

                                    "Content-Type":
                                        "application/json",

                                    Prefer:
                                        "return=minimal"
                                },

                                body:
                                    JSON.stringify({
                                        user_id:
                                            userId,

                                        provider_call_id:
                                            voicemailCallId,

                                        caller_number:
                                            fromNumber,

                                        dialed_number:
                                            customerPhoneNumber,

                                        status:
                                            "processing"
                                    })
                            }
                        );

                    if (!insertResponse.ok) {

                        const insertData =
                            await insertResponse.text();

                        console.error(
                            "❌ Failed to create voicemail record:",
                            insertData
                        );

                    } else {

                        console.log(
                            "✅ Voicemail placeholder created:",
                            voicemailCallId
                        );

                    }

                } else if (!existingResponse.ok) {

                    console.error(
                        "❌ Failed to check existing voicemail:",
                        existingData
                    );

                }

            }

            return res.sendStatus(204);

        } catch (error) {

            console.error(
                "❌ Inbound call-state error:",
                error
            );

            return res.sendStatus(204);
        }

    }
);
// =========================================================
// SIGNALWIRE INBOUND SMS WEBHOOK
// =========================================================

app.post(
    "/api/signalwire/inbound-message",
    async (req, res) => {
        try {

            console.log(
                "💬 SIGNALWIRE INBOUND SMS RECEIVED"
            );

            console.log(
                "Inbound message payload:",
                JSON.stringify(req.body, null, 2)
            );

            const message =
                req.body?.message ||
                req.body?.data?.message ||
                req.body;

            const from =
                message?.from ||
                message?.source?.phone_number ||
                null;

            const to =
                message?.to ||
                message?.destination?.phone_number ||
                null;

            const body =
                message?.body ||
                message?.text ||
                "";

            const providerMessageId =
                message?.message_id ||
                message?.id ||
                null;

            if (!from || !to || !body) {

                console.warn(
                    "⚠️ Inbound SMS missing required fields:",
                    {
                        from,
                        to,
                        body
                    }
                );

                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid inbound SMS payload."
                });
            }

            // -------------------------------------------------
            // Find the Dialeaze user who owns this SignalWire
            // phone number.
            // -------------------------------------------------

            // -------------------------------------------------
// Find the Dialeaze user who owns this number
// -------------------------------------------------

const phoneNumberResponse =
    await fetch(
        `${SUPABASE_URL}/rest/v1/phone_numbers` +
        `?phone_number=eq.${encodeURIComponent(to)}` +
        `&status=eq.assigned` +
        `&select=user_id`,
        {
            method: "GET",
            headers: {
                Authorization:
                    `Bearer ${SUPABASE_SECRET_KEY}`,
                apikey:
                    SUPABASE_SECRET_KEY,
                Accept:
                    "application/json"
            }
        }
    );

const phoneNumberData =
    await phoneNumberResponse.json();

if (
    !phoneNumberResponse.ok ||
    !Array.isArray(phoneNumberData) ||
    !phoneNumberData.length
) {

    console.warn(
        "⚠️ No Dialeaze user found for inbound SMS number:",
        to
    );

    return res.status(200).json({
        success: true,
        stored: false,
        reason:
            "No Dialeaze user owns this phone number."
    });
}

const userId =
    phoneNumberData[0].user_id;

            // -------------------------------------------------
            // Save inbound message to Supabase
            // -------------------------------------------------

            const messageRecord = {
                user_id:
                    userId,

                provider_message_id:
                    providerMessageId,

                from_number:
                    from,

                to_number:
                    to,

                body:
                    body,

                direction:
                    "inbound",

                status:
                    "received"
            };

            const saveResponse =
                await fetch(
                    `${SUPABASE_URL}/rest/v1/messages`,
                    {
                        method: "POST",
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
                            JSON.stringify(
                                messageRecord
                            )
                    }
                );

            const savedMessage =
                await saveResponse.json();

            if (!saveResponse.ok) {

                console.error(
                    "❌ Failed to save inbound SMS:",
                    savedMessage
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Unable to save inbound message."
                });
            }

            console.log(
                "✅ Inbound SMS saved to Supabase."
            );

            return res.status(200).json({
    version: "1.0.0",
    sections: {
        main: []
    }
});

        } catch (error) {

            console.error(
                "❌ Inbound SMS webhook error:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    "Inbound SMS processing failed."
            });
        }
    }
);


// =========================================================
// DIALEAZE VOICEMAIL API
// =========================================================

app.get(
    "/api/voicemails",
    async (req, res) => {

        try {

            // -------------------------------------------------
            // Authenticate the logged-in Dialeaze customer
            // -------------------------------------------------

            const auth =
                await authenticateRequest(req);

            if (!auth.success) {

                return res
                    .status(auth.status)
                    .json({
                        success: false,
                        error: auth.error
                    });

            }

            const userId =
                auth.user.id;

            // -------------------------------------------------
            // Load only this customer's voicemails
            // -------------------------------------------------

            const voicemailResponse =
                await fetch(
                    `${SUPABASE_URL}/rest/v1/voicemails` +
                    `?user_id=eq.${encodeURIComponent(userId)}` +
                    `&select=id,provider_call_id,caller_number,dialed_number,recording_id,recording_url,duration_seconds,status,created_at,updated_at` +
                    `&order=created_at.desc`,
                    {
                        method: "GET",
                        headers: {
                            Authorization:
                                `Bearer ${SUPABASE_SECRET_KEY}`,

                            apikey:
                                SUPABASE_SECRET_KEY,

                            Accept:
                                "application/json"
                        }
                    }
                );

            const voicemailData =
                await voicemailResponse.json();

            if (!voicemailResponse.ok) {

                console.error(
                    "❌ Failed to load voicemails:",
                    voicemailData
                );

                return res
                    .status(500)
                    .json({
                        success: false,
                        error:
                            "Unable to load your voicemails."
                    });

            }

            // -------------------------------------------------
            // Return the customer's voicemail list
            // -------------------------------------------------

            return res.json({
                success: true,
                voicemails:
                    Array.isArray(voicemailData)
                        ? voicemailData
                        : []
            });

        } catch (error) {

            console.error(
                "❌ Voicemail API error:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    error:
                        "Unable to load your voicemails."
                });

        }

    }
);

// =========================================================
// DIALEAZE DELETE VOICEMAIL API
// =========================================================

app.delete(
    "/api/voicemails/:id",
    async (req, res) => {

        try {

            // -------------------------------------------------
            // Authenticate the logged-in Dialeaze customer
            // -------------------------------------------------

            const auth =
                await authenticateRequest(req);

            if (!auth.success) {

                return res
                    .status(auth.status)
                    .json({
                        success: false,
                        error: auth.error
                    });

            }

            const userId =
                auth.user.id;

            const voicemailId =
                req.params.id;

            if (!voicemailId) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        error:
                            "Voicemail ID is required."
                    });

            }

            // -------------------------------------------------
            // Delete ONLY a voicemail belonging to this user
            // -------------------------------------------------

            const deleteResponse =
                await fetch(
                    `${SUPABASE_URL}/rest/v1/voicemails` +
                    `?id=eq.${encodeURIComponent(voicemailId)}` +
                    `&user_id=eq.${encodeURIComponent(userId)}`,
                    {
                        method: "DELETE",

                        headers: {
                            Authorization:
                                `Bearer ${SUPABASE_SECRET_KEY}`,

                            apikey:
                                SUPABASE_SECRET_KEY,

                            Accept:
                                "application/json",

                            Prefer:
                                "return=representation"
                        }
                    }
                );

            const deleteData =
                await deleteResponse.json();

            if (!deleteResponse.ok) {

                console.error(
                    "❌ Failed to delete voicemail:",
                    deleteData
                );

                return res
                    .status(500)
                    .json({
                        success: false,
                        error:
                            "Unable to delete voicemail."
                    });

            }

            // -------------------------------------------------
            // No matching voicemail means:
            // - voicemail does not exist
            // - OR it belongs to another user
            // -------------------------------------------------

            if (
                !Array.isArray(deleteData) ||
                deleteData.length === 0
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        error:
                            "Voicemail not found."
                    });

            }

            // -------------------------------------------------
            // Successfully deleted
            // -------------------------------------------------

            console.log(
                "🗑️ Voicemail deleted:",
                {
                    voicemailId,
                    userId
                }
            );

            return res.json({
                success: true,
                message:
                    "Voicemail deleted successfully."
            });

        } catch (error) {

            console.error(
                "❌ Delete voicemail API error:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    error:
                        "Unable to delete voicemail."
                });

        }

    }
);
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