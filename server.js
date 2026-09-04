const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Telnyx = require("telnyx");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const telnyx = new Telnyx({
    apiKey: process.env.TELNYX_API_KEY
});

// ----------------------------------------
// Health check
// ----------------------------------------
app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        message: "MyDialer server is running"
    });
});

// ----------------------------------------
// Telnyx API connection test
// ----------------------------------------
app.get("/api/telnyx-test", async (req, res) => {
    try {
        const response = await telnyx.balance.retrieve();

        res.json({
            success: true,
            message: "Telnyx connection successful",
            balance: response
        });

    } catch (error) {
        console.error("Telnyx error:", error);

        res.status(500).json({
            success: false,
            message: "Telnyx connection failed",
            error: error.message
        });
    }
});

// ----------------------------------------
// Generate WebRTC login token
// ----------------------------------------
app.get("/api/telnyx-token", async (req, res) => {
    try {
        const credentialId =
            process.env.TELNYX_TELEPHONY_CREDENTIAL_ID;

        if (!credentialId) {
            return res.status(500).json({
                success: false,
                message: "TELNYX_TELEPHONY_CREDENTIAL_ID is missing"
            });
        }

        const token =
            await telnyx.telephonyCredentials.createToken(
                credentialId
            );

        res.json({
            success: true,
            token: token
        });

    } catch (error) {
        console.error("WebRTC token error:", error);

        res.status(500).json({
            success: false,
            message: "Could not create Telnyx WebRTC token",
            error: error.message
        });
    }
});

// ----------------------------------------
// Telnyx Voice Webhook
// ----------------------------------------
app.post("/api/telnyx/webhook", (req, res) => {
    try {
        const event = req.body?.data;

        console.log("\n========== TELNYX WEBHOOK ==========");

        console.log(
            JSON.stringify(req.body, null, 2)
        );

        if (event) {
            console.log("Event:", event.event_type);
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

        console.log("====================================\n");

        res.sendStatus(200);

    } catch (error) {
        console.error("Webhook error:", error);
        res.sendStatus(500);
    }
});

// ----------------------------------------
// Start server
// ----------------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `MyDialer running at http://localhost:${PORT}`
    );
});