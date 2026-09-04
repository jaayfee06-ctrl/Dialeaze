import { TelnyxRTC } from "/telnyx-webrtc.mjs";

const phoneNumber = document.getElementById("phoneNumber");
const status = document.getElementById("status");

const callButton = document.getElementById("callButton");
const hangupButton = document.getElementById("hangupButton");

const dialButtons = document.querySelectorAll(".dialpad button");

let client = null;
let currentCall = null;

// ----------------------------------------
// Dialpad
// ----------------------------------------

dialButtons.forEach(button => {
    button.addEventListener("click", () => {
        phoneNumber.value += button.textContent;
    });
});

// ----------------------------------------
// Start Telnyx WebRTC
// ----------------------------------------

async function initializeTelnyx() {
    try {
        status.textContent = "Connecting...";

        const response = await fetch("/api/telnyx-token");

        if (!response.ok) {
            throw new Error("Could not get Telnyx token");
        }

        const data = await response.json();

        if (!data.success || !data.token) {
            throw new Error("Telnyx token was not returned");
        }

        client = new TelnyxRTC({
            login_token: data.token
        });

        client.remoteElement = "remoteMedia";

        // Telnyx connection ready
        client.on("telnyx.ready", () => {
            console.log("Telnyx WebRTC is ready");
            status.textContent = "Ready";
        });

        // Telnyx notifications
        client.on("telnyx.notification", notification => {
            console.log("Telnyx notification:", notification);

            const call = notification?.call;

            if (!call) {
                return;
            }

            currentCall = call;

            console.log("Call state:", call.state);

            if (call.state === "ringing") {
                status.textContent = "Ringing...";
            }

            if (call.state === "active") {
                status.textContent = "Call connected";
            }

            if (
                call.state === "hangup" ||
                call.state === "destroy"
            ) {
                status.textContent = "Call ended";
                currentCall = null;
            }
        });

        client.on("telnyx.error", error => {
            console.error("Telnyx error:", error);
            status.textContent = "Telnyx error";
        });

        // Connect to Telnyx
        client.connect();

    } catch (error) {
        console.error("WebRTC initialization error:", error);
        status.textContent = "Connection failed";
    }
}

// ----------------------------------------
// Make outbound call
// ----------------------------------------

callButton.addEventListener("click", async () => {
    const number = phoneNumber.value.trim();

    if (!number) {
        alert("Please enter a phone number.");
        return;
    }

    if (!client) {
        alert("Telnyx is not connected yet.");
        return;
    }

    try {
        status.textContent = "Calling...";

        currentCall = client.newCall({
            destinationNumber: number,
            callerNumber: "+12132212583"
        });

        console.log("Outgoing call created:", currentCall);

    } catch (error) {
        console.error("Call error:", error);
        status.textContent = "Call failed";
    }
});

// ----------------------------------------
// Hang up
// ----------------------------------------

hangupButton.addEventListener("click", () => {
    if (currentCall) {
        try {
            currentCall.hangup();
        } catch (error) {
            console.error("Hangup error:", error);
        }
    }

    status.textContent = "Call ended";
    currentCall = null;
});

// ----------------------------------------
// Initialize
// ----------------------------------------

initializeTelnyx();