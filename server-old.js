const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Telnyx = require("telnyx");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const telnyx = new Telnyx({
    apiKey: process.env.TELNYX_API_KEY
});


// ========================================
// CUSTOMER / ACCOUNT CONFIGURATION
// ========================================

const customerAccount = {
    email:
        process.env.CUSTOMER_EMAIL ||
        "abc@abc.com",

    displayName:
        process.env.CUSTOMER_NAME ||
        "ABC",

    phoneNumber:
        process.env.TELNYX_PHONE_NUMBER ||
        "+12132212583"
};


// ========================================
// TEMPORARY MESSAGE STORE
// ========================================
//
// This is temporary while Supabase is unavailable.
// Later we will move this into the database.
//

let messages = [];


// ========================================
// HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {

    res.json({
        status: "OK",
        message: "MyDialer server is running"
    });

});


// ========================================
// CUSTOMER ACCOUNT
// ========================================

app.get("/api/account", (req, res) => {

    res.json({
        success: true,

        account: {
            email:
                customerAccount.email,

            displayName:
                customerAccount.displayName,

            phoneNumber:
                customerAccount.phoneNumber
        }
    });

});


// ========================================
// TELNYX API CONNECTION TEST
// ========================================

app.get("/api/telnyx-test", async (req, res) => {

    try {

        const response =
            await telnyx.balance.retrieve();

        res.json({
            success: true,
            message:
                "Telnyx connection successful",
            balance:
                response
        });

    }

    catch (error) {

        console.error(
            "Telnyx error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Telnyx connection failed",
            error:
                error.message
        });

    }

});


// ========================================
// GENERATE WEBRTC LOGIN TOKEN
// ========================================

app.get("/api/telnyx-token", async (req, res) => {

    try {

        const credentialId =
            process.env.TELNYX_TELEPHONY_CREDENTIAL_ID;

        if (!credentialId) {

            return res.status(500).json({
                success: false,
                message:
                    "TELNYX_TELEPHONY_CREDENTIAL_ID is missing"
            });

        }

        const token =
            await telnyx.telephonyCredentials.createToken(
                credentialId
            );

        res.json({
            success: true,
            token:
                token
        });

    }

    catch (error) {

        console.error(
            "WebRTC token error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Could not create Telnyx WebRTC token",
            error:
                error.message
        });

    }

});


// ========================================
// SEND SMS
// ========================================

app.post("/api/messages/send", async (req, res) => {

    try {

        const to =
            String(
                req.body?.to || ""
            ).trim();

        const text =
            String(
                req.body?.text || ""
            ).trim();


        // ====================================
        // VALIDATION
        // ====================================

        if (!to) {

            return res.status(400).json({
                success: false,
                message:
                    "Recipient phone number is required"
            });

        }


        if (!text) {

            return res.status(400).json({
                success: false,
                message:
                    "Message text is required"
            });

        }


        if (text.length > 1600) {

            return res.status(400).json({
                success: false,
                message:
                    "Message is too long"
            });

        }


        // ====================================
        // SEND THROUGH TELNYX
        // ====================================

        console.log(
            "\n========== SENDING SMS =========="
        );

        console.log(
            "From:",
            customerAccount.phoneNumber
        );

        console.log(
            "To:",
            to
        );

        console.log(
            "Message:",
            text
        );


        const response =
            await telnyx.messages.send({

                from:
                    customerAccount.phoneNumber,

                to:
                    to,

                text:
                    text,

                type:
                    "SMS"

            });


        const sentMessage =
            response.data;


        // ====================================
        // TEMPORARY LOCAL MESSAGE STORE
        // ====================================

        messages.push({

            id:
                sentMessage?.id ||
                `local-${Date.now()}`,

            direction:
                "outbound",

            from:
                customerAccount.phoneNumber,

            to:
                to,

            text:
                text,

            timestamp:
                new Date().toISOString(),

            status:
                "sent"

        });


        // Keep last 500 messages

        messages =
            messages.slice(
                -500
            );


        console.log(
            "SMS sent successfully."
        );

        console.log(
            "================================\n"
        );


        res.json({

            success:
                true,

            message:
                sentMessage

        });

    }

    catch (error) {

        console.error(
            "\n========== SMS ERROR =========="
        );

        console.error(
            error
        );

        console.error(
            "================================\n"
        );


        res.status(500).json({

            success:
                false,

            message:
                "Could not send SMS",

            error:
                error.message

        });

    }

});


// ========================================
// GET MESSAGES
// ========================================

app.get("/api/messages", (req, res) => {

    try {

        const phone =
            String(
                req.query?.phone || ""
            ).trim();


        // If a phone number was supplied,
        // return only that conversation.

        if (phone) {

            const conversation =
                messages.filter(
                    message =>
                        message.from === phone ||
                        message.to === phone
                );

            return res.json({

                success:
                    true,

                messages:
                    conversation

            });

        }


        res.json({

            success:
                true,

            messages:
                messages

        });

    }

    catch (error) {

        console.error(
            "Message retrieval error:",
            error
        );

        res.status(500).json({

            success:
                false,

            message:
                "Could not retrieve messages"

        });

    }

});


// ========================================
// TELNYX WEBHOOK
// ========================================

app.post("/api/telnyx/webhook", (req, res) => {

    try {

        const event =
            req.body?.data;


        console.log(
            "\n========== TELNYX WEBHOOK =========="
        );


        console.log(
            JSON.stringify(
                req.body,
                null,
                2
            )
        );


        if (!event) {

            console.log(
                "No event data received."
            );

            return res.sendStatus(200);

        }


        const eventType =
            event.event_type;


        console.log(
            "Event:",
            eventType
        );


        // ====================================
        // INCOMING SMS
        // ====================================

        if (
            eventType ===
            "message.received"
        ) {

            const payload =
                event.payload;


            const incomingFrom =
                payload?.from?.phone_number;


            const incomingTo =
                payload?.to?.[0]?.phone_number;


            const incomingText =
                payload?.text || "";


            const messageId =
                payload?.id ||
                event.id;


            console.log(
                "Incoming SMS from:",
                incomingFrom
            );


            console.log(
                "Incoming SMS to:",
                incomingTo
            );


            console.log(
                "Incoming SMS:",
                incomingText
            );


            // =================================
            // AVOID DUPLICATES
            // =================================

            const alreadyExists =
                messages.some(
                    message =>
                        message.id ===
                        messageId
                );


            if (!alreadyExists) {

                messages.push({

                    id:
                        messageId,

                    direction:
                        "inbound",

                    from:
                        incomingFrom,

                    to:
                        incomingTo,

                    text:
                        incomingText,

                    timestamp:
                        payload?.received_at ||
                        event.occurred_at ||
                        new Date().toISOString(),

                    status:
                        "received"

                });


                messages =
                    messages.slice(
                        -500
                    );

            }

        }


        // ====================================
        // OUTBOUND MESSAGE EVENTS
        // ====================================

        if (
            eventType ===
            "message.sent" ||
            eventType ===
            "message.finalized"
        ) {

            console.log(
                "Message status event:",
                eventType
            );

        }


        // ====================================
        // VOICE WEBHOOK
        // ====================================

        if (
            eventType !==
                "message.received" &&
            eventType !==
                "message.sent" &&
            eventType !==
                "message.finalized"
        ) {

            console.log(
                "Call Control ID:",
                event.payload?.call_control_id
            );

            console.log(
                "Direction:",
                event.payload?.direction
            );

            console.log(
                "From:",
                event.payload?.from
            );

            console.log(
                "To:",
                event.payload?.to
            );

        }


        console.log(
            "====================================\n"
        );


        // Telnyx expects a quick 2xx response.

        res.sendStatus(200);

    }

    catch (error) {

        console.error(
            "Webhook error:",
            error
        );

        res.sendStatus(500);

    }

});


// ========================================
// START SERVER
// ========================================

const PORT =
    process.env.PORT ||
    3000;


app.listen(
    PORT,
    () => {

        console.log(
            `MyDialer running at http://localhost:${PORT}`
        );

        console.log(
            "Customer:",
            customerAccount.email
        );

        console.log(
            "Business Number:",
            customerAccount.phoneNumber
        );

    }
);