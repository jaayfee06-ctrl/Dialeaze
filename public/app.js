import {
    SignalWire,
    StaticCredentialProvider
} from "https://esm.sh/@signalwire/js@4.0.0-rc.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


// =========================================================
// SUPABASE
// =========================================================

const SUPABASE_URL =
    "https://bgvzfkocbvcstowswixh.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_45kBWskrAeltQsVHAtyWmQ__npKIYvd";
const supabase =
    createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

    // =========================================================
// DIALEAZE DASHBOARD AUTHENTICATION BRIDGE
// =========================================================

window.addEventListener(
    "message",
    async function (event) {

        // Only accept messages from the real Dialeaze website
        if (
            event.origin !==
            "https://dialeaze.com"
        ) {
            return;
        }


        // Only accept messages from the dashboard
        // window that opened this dialer
        if (
            event.source !==
            window.opener
        ) {
            return;
        }


        const data =
            event.data;


        // Ignore unrelated messages
        if (
            !data ||
            data.type !==
            "DIALEAZE_AUTH"
        ) {
            return;
        }


        if (
            !data.accessToken
        ) {

            console.error(
                "Dialeaze authentication failed: access token missing."
            );

            return;

        }


        console.log(
            "Dialeaze dashboard authentication received."
        );


        try {

            const sessionResult =
                await supabase.auth.setSession({

                    access_token:
                        data.accessToken,

                    refresh_token:
                        data.refreshToken ||
                        ""

                });


            if (
                sessionResult.error
            ) {

                throw sessionResult.error;

            }


            console.log(
                "Dialeaze Supabase session established."
            );


            // Now load this customer's account
            await initializeApp();


        }
               catch (error) {

            console.error(
                "Dialeaze authentication error:",
                error
            );

            alert(
                "Unable to connect your Dialeaze account. Please log in again."
            );

        }

    }

);

   
// =========================================================
// DIALEAZE DASHBOARD AUTH BRIDGE
// Receives the logged-in customer's Supabase session
// from https://dialeaze.com
// =========================================================



async function getCurrentSession() {

    // -----------------------------------------------------
    // 1. Try normal Supabase session
    // -----------------------------------------------------

    try {

        const {
            data,
            error
        } = await supabase.auth.getSession();

        if (
            !error &&
            data &&
            data.session &&
            data.session.access_token
        ) {

            console.log(
                "Supabase session found normally."
            );

            return data.session;
        }

    } catch (error) {

        console.warn(
            "Normal Supabase session check failed:",
            error
        );

    }


    // -----------------------------------------------------
    // 2. Try saved Dialeaze access token
    // -----------------------------------------------------

    const savedToken =
        localStorage.getItem(
            "dialeaze_access_token"
        );


    if (!savedToken) {

        throw new Error(
            "Your login session has expired. Please log in again."
        );

    }


    console.log(
        "Checking saved Dialeaze access token..."
    );


    // -----------------------------------------------------
    // 3. Verify saved token directly with Supabase
    // -----------------------------------------------------

    try {

        const response =
            await fetch(
                `${SUPABASE_URL}/auth/v1/user`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${savedToken}`,

                        "apikey":
                            SUPABASE_PUBLISHABLE_KEY
                    }
                }
            );


        const user =
            await response.json();


        if (
            !response.ok ||
            !user ||
            !user.id
        ) {

            console.error(
                "Saved access token rejected:",
                user
            );


            localStorage.removeItem(
                "dialeaze_access_token"
            );

            localStorage.removeItem(
                "dialeaze_refresh_token"
            );

            localStorage.removeItem(
                "dialeaze_user"
            );


            throw new Error(
                "Your login session has expired. Please log in again."
            );

        }


        console.log(
            "Saved Dialeaze token verified.",
            user.id
        );


        // Return a session-like object so the rest
        // of the application can use it.

        return {
            access_token: savedToken,
            user: user
        };

    } catch (error) {

        console.error(
            "Saved token verification failed:",
            error
        );

        throw new Error(
            error.message ||
            "Could not verify your login session."
        );

    }

}



// =========================================================
// ACCESS TOKEN
// =========================================================

async function getAccessToken() {

    const session =
        await getCurrentSession();

    return session.access_token;

}


// =========================================================
// AUTHENTICATED FETCH
// =========================================================

async function authFetch(
    url,
    options = {}
) {

    const token =
        await getAccessToken();


    const headers =
        new Headers(
            options.headers || {}
        );


    headers.set(
        "Authorization",
        `Bearer ${token}`
    );


    return fetch(
        url,
        {
            ...options,
            headers
        }
    );

}



// =========================================================
// DOM ELEMENTS
// =========================================================

const phoneNumber =
    document.getElementById("phoneNumber");

const status =
    document.getElementById("status");

const callButton =
    document.getElementById("callButton");

const hangupButton =
    document.getElementById("hangupButton");

const dialButtons =
    document.querySelectorAll(
        ".dialpad button"
    );

const backspaceButton =
    document.getElementById(
        "backspaceButton"
    );

const clearButton =
    document.getElementById(
        "clearButton"
    );

const clearKeyButton =
    document.getElementById(
        "clearKeyButton"
    );

const callHistoryList =
    document.getElementById(
        "callHistoryList"
    );

const recentCallsList =
    document.getElementById(
        "recentCallsList"
    );

const historyToggleButton =
    document.getElementById(
        "historyToggleButton"
    );

const callHistoryPanel =
    document.getElementById(
        "callHistoryPanel"
    );

const callTimerText =
    document.getElementById(
        "callTimerText"
    );

const userName =
    document.getElementById(
        "userName"
    );

const userInitials =
    document.getElementById(
        "userInitials"
    );

const businessNumber =
    document.getElementById(
        "businessNumber"
    );


// =========================================================
// MESSAGE DOM ELEMENTS
// =========================================================

const messagesCard =
    document.getElementById(
        "messagesCard"
    );

const messagesOverlay =
    document.getElementById(
        "messagesOverlay"
    );

const closeMessagesButton =
    document.getElementById(
        "closeMessagesButton"
    );

const messagesBusinessNumber =
    document.getElementById(
        "messagesBusinessNumber"
    );

const messageRecipient =
    document.getElementById(
        "messageRecipient"
    );

const messagesConversation =
    document.getElementById(
        "messagesConversation"
    );

const messageText =
    document.getElementById(
        "messageText"
    );

const messageCharacterCount =
    document.getElementById(
        "messageCharacterCount"
    );

const sendMessageButton =
    document.getElementById(
        "sendMessageButton"
    );


// =========================================================
// VARIABLES
// =========================================================

let client = null;
let signalWireInitializationPromise = null;

let currentCall = null;

let currentCallHistory = null;

let callStartTime = null;

let currentOutboundUsageId = null;

let callTimerInterval = null;

let customerAccount = null;

let messagePollingInterval = null;

let currentUserId = null;


// =========================================================
// INITIAL BUTTON STATE
// =========================================================

if (callButton) {
    callButton.disabled = true;
}

if (hangupButton) {
    hangupButton.disabled = true;
}

if (sendMessageButton) {
    sendMessageButton.disabled = true;
}


// =========================================================
// USER-SPECIFIC STORAGE KEYS
// =========================================================



function getMessageStorageKey() {

    if (!currentUserId) {
        return "myDialerMessages";
    }

    return (
        "myDialerMessages_" +
        currentUserId
    );
}


// =========================================================
// CALL HISTORY
// =========================================================

let callHistory = [];


// =========================================================
// MESSAGE LOCAL CACHE
// =========================================================

let localMessages = [];


// =========================================================
// LOAD USER-SPECIFIC LOCAL DATA
// =========================================================

async function loadLocalUserData() {

    if (!currentUserId) {

        callHistory = [];

        localMessages = [];

        return;
    }

    try {

        const response = await authFetch(
            "/api/call-history"
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error ||
                "Unable to load call history."
            );
        }

        callHistory = (data.calls || []).map(
            call => ({

                id:
                    call.id,

                phoneNumber:
                    call.phone_number,

                callerNumber:
                    call.caller_number,

                direction:
                    call.direction,

                status:
                    call.status,

                startedAt:
                    call.started_at
                        ? new Date(
                              call.started_at
                          ).getTime()
                        : null,

                connectedAt:
                    call.connected_at
                        ? new Date(
                              call.connected_at
                          ).getTime()
                        : null,

                endedAt:
                    call.ended_at
                        ? new Date(
                              call.ended_at
                          ).getTime()
                        : null,

                duration:
                    Number(
                        call.duration
                    ) || 0,

                time:
                    call.created_at
            })
        );

        console.log(
            "Call history loaded from Supabase:",
            callHistory
        );

    } catch (error) {

        console.error(
            "Supabase call history load error:",
            error
        );

        callHistory = [];
    }


    // Keep your existing local message storage.

    try {

        localMessages =
            JSON.parse(
                localStorage.getItem(
                    getMessageStorageKey()
                )
            ) || [];

    } catch {

        localMessages = [];

    }


    renderRecentCalls();

    renderCallHistory();

}

// =========================================================
// SAVE CALL HISTORY
// =========================================================

async function saveCallHistoryToSupabase(callRecord) {

    if (!currentUserId || !callRecord) {
        return;
    }

    try {

        const response = await authFetch(
            "/api/call-history",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    phoneNumber:
                        callRecord.phoneNumber || "",

                    callerNumber:
                        callRecord.callerNumber ||
                        callRecord.caller_number ||
                        "",

                    direction:
                        callRecord.direction ||
                        "Outbound",

                    status:
                        callRecord.status ||
                        "Completed",

                    startedAt:
                        callRecord.startedAt
                            ? new Date(
                                  callRecord.startedAt
                              ).toISOString()
                            : null,

                    connectedAt:
                        callRecord.connectedAt
                            ? new Date(
                                  callRecord.connectedAt
                              ).toISOString()
                            : null,

                    endedAt:
                        callRecord.endedAt
                            ? new Date(
                                  callRecord.endedAt
                              ).toISOString()
                            : null,

                    duration:
                        Number(
                            callRecord.duration
                        ) || 0
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error ||
                "Unable to save call history."
            );
        }

        console.log(
            "Call history saved to Supabase:",
            data.call
        );

        return data.call;

    } catch (error) {

        console.error(
            "Supabase call history save error:",
            error
        );
    }
}


// =========================================================
// SAVE LOCAL MESSAGES
// =========================================================

function saveLocalMessages() {

    if (!currentUserId) {
        return;
    }

    localStorage.setItem(
        getMessageStorageKey(),
        JSON.stringify(
            localMessages
        )
    );
}


// =========================================================
// FORMAT PHONE NUMBER
// =========================================================

function formatPhoneNumber(number) {

    if (!number) {
        return "";
    }

    const digits =
        number.replace(
            /\D/g,
            ""
        );


    if (
        digits.length === 11 &&
        digits.startsWith("1")
    ) {

        return (
            "+1 (" +
            digits.substring(1, 4) +
            ") " +
            digits.substring(4, 7) +
            "-" +
            digits.substring(7, 11)
        );

    }


    return number;
}


// =========================================================
// NORMALIZE PHONE NUMBER
// =========================================================

function normalizePhoneNumber(number) {

    if (!number) {
        return "";
    }


    const cleaned =
        number
            .replace(
                /[^\d+]/g,
                ""
            );


    if (
        cleaned.length === 10 &&
        !cleaned.startsWith("+")
    ) {

        return "+1" + cleaned;

    }


    if (
        cleaned.length === 11 &&
        cleaned.startsWith("1")
    ) {

        return "+" + cleaned;

    }


    return cleaned;
}


// =========================================================
// FORMAT DURATION
// =========================================================

function formatDuration(seconds) {

    if (!seconds) {
        return "--";
    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    const remainingSeconds =
        seconds % 60;


    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(remainingSeconds).padStart(2, "0")
    );
}


// =========================================================
// FORMAT TIME
// =========================================================

function formatTime(dateString) {

    try {

        const date =
            new Date(
                dateString
            );


        return date.toLocaleTimeString(
            [],
            {
                hour: "numeric",
                minute: "2-digit"
            }
        );

    } catch {

        return "";

    }
}


// =========================================================
// GET INITIALS
// =========================================================

function getInitials(
    name,
    email
) {

    const value =
        name ||
        email ||
        "";


    const parts =
        value
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (
        parts.length >= 2
    ) {

        return (
            parts[0][0] +
            parts[1][0]
        ).toUpperCase();

    }


    if (
        parts.length === 1
    ) {

        return (
            parts[0]
                .substring(
                    0,
                    2
                )
                .toUpperCase()
        );

    }


    return "AC";
}


// =========================================================
// LOAD CUSTOMER ACCOUNT
// =========================================================

async function loadCustomerAccount() {

    try {

        status.textContent =
            "Checking account...";


        const session =
            await getCurrentSession();


        currentUserId =
            session.user.id;


        await loadLocalUserData();


        console.log(
            "Authenticated Supabase user:",
            session.user.id
        );


        const response =
            await authFetch(
                "/api/account"
            );


        if (!response.ok) {

            let errorData = null;

            try {

                errorData =
                    await response.json();

            } catch {

                errorData = null;

            }


            throw new Error(
                errorData?.message ||
                errorData?.error ||
                "Could not load customer account"
            );

        }


        const data =
            await response.json();


        if (
            !data.success ||
            !data.account
        ) {

            throw new Error(
                "Customer account was not returned"
            );

        }


        customerAccount =
            data.account;


        // =================================================
        // CUSTOMER NAME / EMAIL
        // =================================================

        if (userName) {

            userName.textContent =
                customerAccount.displayName ||
                customerAccount.email ||
                session.user.email ||
                "";

        }


        // =================================================
        // AVATAR
        // =================================================

        if (userInitials) {

            userInitials.textContent =
                getInitials(
                    customerAccount.displayName,
                    customerAccount.email ||
                    session.user.email
                );

        }


        // =================================================
        // BUSINESS NUMBER
        // =================================================

        if (businessNumber) {

            const displayNumber =
                customerAccount.phoneNumber ||
                customerAccount.telnyxPhoneNumber ||
                "";

            businessNumber.textContent =
                displayNumber
                    ? formatPhoneNumber(
                        displayNumber
                    )
                    : "Number unavailable";

        }


        // =================================================
        // MESSAGE WINDOW NUMBER
        // =================================================

        if (
            messagesBusinessNumber
        ) {

            const displayNumber =
                customerAccount.phoneNumber ||
                customerAccount.telnyxPhoneNumber ||
                "";


            messagesBusinessNumber.textContent =
                displayNumber
                    ? "From " +
                      formatPhoneNumber(
                          displayNumber
                      )
                    : "Number unavailable";

        }


        console.log(
            "Customer account loaded:",
            customerAccount
        );


        return true;

    }


    catch (error) {

        console.error(
            "Account loading error:",
            error
        );


        currentUserId =
            null;


        customerAccount =
            null;


        if (userName) {

            userName.textContent =
                "Account unavailable";

        }


        if (businessNumber) {

            businessNumber.textContent =
                "Number unavailable";

        }


        if (messagesBusinessNumber) {

            messagesBusinessNumber.textContent =
                "Number unavailable";

        }


        status.textContent =
            "Login required";


        if (callButton) {
            callButton.disabled = true;
        }


        if (hangupButton) {
            hangupButton.disabled = true;
        }


        if (sendMessageButton) {
            sendMessageButton.disabled = true;
        }


        return false;

    }

}


// =========================================================
// RENDER RECENT CALLS
// =========================================================

function renderRecentCalls() {

    if (!recentCallsList) {
        return;
    }


    if (
        callHistory.length === 0
    ) {

        recentCallsList.innerHTML = `
            <div class="empty-recent">
                No recent calls
            </div>
        `;

        return;
    }


    recentCallsList.innerHTML =
        "";


    const recentCalls =
        callHistory.slice(
            0,
            4
        );


    recentCalls.forEach(
        call => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "recent-call";


            item.innerHTML = `

                <div class="recent-left">

                    <div class="recent-icon">
                        ↗
                    </div>

                    <div>

                        <div class="recent-number">
                            ${call.phoneNumber}
                        </div>

                        <div class="recent-details">
                            Outbound · ${call.status}
                        </div>

                    </div>

                </div>

                <div class="recent-time">
                    ${formatTime(call.time)}
                </div>

            `;


            recentCallsList.appendChild(
                item
            );

        }
    );

}


// =========================================================
// RENDER FULL CALL HISTORY
// =========================================================

function renderCallHistory() {

    if (!callHistoryList) {
        return;
    }


    if (
        callHistory.length === 0
    ) {

        callHistoryList.innerHTML = `
            <p class="empty-history">
                No calls yet
            </p>
        `;

        return;
    }


    callHistoryList.innerHTML =
        "";


    callHistory.forEach(
        call => {

            const callItem =
                document.createElement(
                    "div"
                );


            callItem.className =
                "call-history-item";


            callItem.innerHTML = `

                <div class="call-history-left">

                    <div class="call-icon">
                        ↗
                    </div>

                    <div>

                        <div class="call-history-number">
                            ${call.phoneNumber}
                        </div>

                        <div class="call-history-details">
                            Outbound · ${call.status}
                        </div>

                    </div>

                </div>


                <div class="call-history-right">

                    <div class="call-history-duration">
                        ${formatDuration(
                            call.duration
                        )}
                    </div>

                    <div class="call-history-time">
                        ${call.time}
                    </div>

                </div>

            `;


            callHistoryList.appendChild(
                callItem
            );

        }
    );

}


// =========================================================
// HISTORY TOGGLE
// =========================================================

if (
    historyToggleButton &&
    callHistoryPanel
) {

    historyToggleButton.addEventListener(
        "click",
        () => {

            const isOpen =
                callHistoryPanel.classList.contains(
                    "open"
                );


            if (isOpen) {

                callHistoryPanel.classList.remove(
                    "open"
                );

                historyToggleButton.textContent =
                    "CALL HISTORY";

            }

            else {

                callHistoryPanel.classList.add(
                    "open"
                );

                historyToggleButton.textContent =
                    "HIDE CALL HISTORY";

            }

        }
    );

}


// =========================================================
// DIALPAD
// =========================================================

dialButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                if (
                    button.id ===
                    "backspaceButton"
                ) {
                    return;
                }


                if (
                    button.id ===
                    "clearKeyButton"
                ) {
                    return;
                }


                phoneNumber.value +=
                    button.querySelector(
                        "span"
                    )?.textContent ||
                    button.textContent;


                phoneNumber.focus();

            }
        );

    }
);


// =========================================================
// BACKSPACE
// =========================================================

if (backspaceButton) {

    backspaceButton.addEventListener(
        "click",
        () => {

            phoneNumber.value =
                phoneNumber.value.slice(
                    0,
                    -1
                );


            phoneNumber.focus();

        }
    );

}


// =========================================================
// CLEAR INPUT
// =========================================================

function clearPhoneNumber() {

    phoneNumber.value =
        "";

    phoneNumber.focus();

}


if (clearButton) {

    clearButton.addEventListener(
        "click",
        clearPhoneNumber
    );

}


if (clearKeyButton) {

    clearKeyButton.addEventListener(
        "click",
        clearPhoneNumber
    );

}


// =========================================================
// KEYBOARD PHONE INPUT
// =========================================================

phoneNumber.addEventListener(
    "input",
    () => {

        phoneNumber.value =
            phoneNumber.value.replace(
                /[^\d+#*+]/g,
                ""
            );

    }
);


// =========================================================
// CALL TIMER
// =========================================================

function startCallTimer() {

    stopCallTimer();


    if (!callTimerText) {
        return;
    }


    callTimerText.textContent =
        "On call · 00:00";


    const startTime =
        Date.now();


    callTimerInterval =
        setInterval(
            () => {

                const seconds =
                    Math.floor(
                        (
                            Date.now() -
                            startTime
                        ) / 1000
                    );


                callTimerText.textContent =
                    "On call · " +
                    formatDuration(
                        seconds
                    );

            },
            1000
        );

}


function stopCallTimer() {

    if (callTimerInterval) {

        clearInterval(
            callTimerInterval
        );

        callTimerInterval =
            null;

    }


    if (callTimerText) {

        callTimerText.textContent =
            "Ready";

    }

}

async function initializeSignalWire() {
    if (signalWireInitializationPromise) {
        return signalWireInitializationPromise;
    }

    signalWireInitializationPromise = (async () => {
        try {
            console.log("========================================");
            console.log("INITIALIZING SIGNALWIRE...");
            console.log("========================================");

            if (!customerAccount) {
                console.error("No customer account available.");
                return false;
            }

            status.textContent = "Connecting...";

            const response = await authFetch("/api/signalwire-token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({})
            });

            const data = await response.json();

            console.log("SIGNALWIRE TOKEN RESPONSE:", {
                success: data.success,
                subscriberId: data.subscriberId,
                expiresAt: data.expiresAt
            });

            if (!response.ok || !data.success || !data.token) {
                throw new Error(
                    data.error || "Unable to get SignalWire token."
                );
            }

            console.log("Creating SignalWire client...");

            client = new SignalWire(
                new StaticCredentialProvider({
                    token: data.token
                }),
                {
                    skipRegister: true
                }
            );

            console.log("SignalWire client created.");

            await client.register();

            console.log("✅ SIGNALWIRE REGISTERED");

            // =========================================================
// SIGNALWIRE INCOMING CALL LISTENER
// =========================================================

if (client.session && client.session.incomingCalls$) {

    client.session.incomingCalls$.subscribe((calls) => {

        console.log("📞 Incoming calls update:", calls);

        const ringingCall = calls.find(
            (call) => call.status === "ringing"
        );

        if (!ringingCall) {
            return;
        }

        console.log("📲 INCOMING SIGNALWIRE CALL:", ringingCall);

        currentCall = ringingCall;

        const callerName =
            ringingCall.fromName &&
            ringingCall.fromName !== "_undef_"
                ? ringingCall.fromName
                : ringingCall.from || "Unknown";

        console.log("📞 Caller:", callerName);

        // Show your existing incoming-call panel
        if (incomingCallPanel) {
            incomingCallPanel.style.display = "flex";
        }

        // Update caller name if your UI has this element
        const incomingCallerName =
            document.getElementById("incomingCallerName");

        if (incomingCallerName) {
            incomingCallerName.textContent = callerName;
        }

        status.textContent = "Incoming call";

        callButton.disabled = true;
        hangupButton.disabled = false;

        // Listen for incoming call state changes
        ringingCall.status$.subscribe((callStatus) => {

            console.log(
                "📡 Incoming SignalWire call status:",
                callStatus
            );

            if (callStatus === "connected") {
                status.textContent = "Connected";
                startCallTimer();
            }

            if (
                callStatus === "disconnected" ||
                callStatus === "destroyed"
            ) {
                console.log("📴 Incoming call ended.");

                if (incomingCallPanel) {
                    incomingCallPanel.style.display = "none";
                }

                status.textContent = "Call ended";

                stopCallTimer();

                callButton.disabled = false;
                hangupButton.disabled = true;

                if (currentCall === ringingCall) {
                    currentCall = null;
                }
            }
        });

        // Receive the other person's audio
        if (ringingCall.remoteStream$) {

            ringingCall.remoteStream$.subscribe(async (stream) => {

                console.log(
                    "🔊 Incoming remote audio stream received."
                );

                let remoteAudio =
                    document.getElementById(
                        "signalWireRemoteAudio"
                    );

                if (!remoteAudio) {

                    remoteAudio =
                        document.createElement("audio");

                    remoteAudio.id =
                        "signalWireRemoteAudio";

                    remoteAudio.autoplay = true;
                    remoteAudio.playsInline = true;
                    remoteAudio.controls = false;

                    document.body.appendChild(remoteAudio);
                }

                remoteAudio.muted = false;
                remoteAudio.volume = 1.0;
                remoteAudio.srcObject = stream;

                try {
                    await remoteAudio.play();

                    console.log(
                        "🔊 Incoming remote audio playing."
                    );

                } catch (error) {

                    console.error(
                        "❌ Could not play incoming remote audio:",
                        error
                    );
                }
            });
        }
    });

    console.log("✅ SignalWire incoming-call listener ready.");
}

            status.textContent = "Connected";

            const callButton = document.getElementById("callButton");

            if (callButton) {
                callButton.disabled = false;
            }

            const hangupButton = document.getElementById("hangupButton");

            if (hangupButton) {
                hangupButton.disabled = true;
            }

            currentUserId = customerAccount.userId || currentUserId;

            console.log("SignalWire browser connection is READY.");

            return true;

        } catch (error) {
            console.error("❌ SIGNALWIRE INITIALIZATION ERROR:", error);

            status.textContent = "Connection failed";

            return false;
        }
    })();

    return signalWireInitializationPromise;
}



// =========================================================
// INCOMING CALL CONTROLS
// =========================================================

const incomingCallPanel =
    document.getElementById("incomingCallPanel");

const acceptCallButton =
    document.getElementById("acceptCallButton");

const rejectCallButton =
    document.getElementById("rejectCallButton");


// ACCEPT INCOMING CALL
if (acceptCallButton) {

    acceptCallButton.addEventListener("click", async () => {

        if (!currentCall) {
            console.warn("No incoming call to answer.");
            return;
        }

        try {

            console.log("✅ Accepting incoming call...");
            currentCall.answer({
    audio: true,
    video: false
});

console.log("✅ Incoming call answered.");

if (incomingCallPanel) {
    incomingCallPanel.style.display = "none";
}

status.textContent = "Connected";
startCallTimer();

        }


        catch (error) {

            console.error(
                "Call error:",
                error
            );


            status.textContent =
                "Call failed";


            callButton.disabled =
                false;


            hangupButton.disabled =
                true;


            currentCall =
                null;


            currentCallHistory =
                null;

        }

    }
);

}

// REJECT INCOMING CALL
if (rejectCallButton) {

    rejectCallButton.addEventListener("click", async () => {

        if (!currentCall) {
            console.warn("No incoming call to reject.");
            return;
        }

        try {

            console.log("❌ Rejecting incoming SignalWire call...");

            if (typeof currentCall.reject === "function") {
                await currentCall.reject();
            } else if (typeof currentCall.hangup === "function") {
                await currentCall.hangup();
            }

            console.log("✅ Incoming call rejected.");

        } catch (error) {

            console.error(
                "❌ Could not reject incoming call:",
                error
            );

        }

        if (incomingCallPanel) {
            incomingCallPanel.style.display = "none";
        }

        status.textContent = "Call rejected";

        callButton.disabled = false;
        hangupButton.disabled = true;

        currentCall = null;
    });
}

// =========================================================
// MAKE OUTBOUND CALL
// =========================================================

if (callButton) {

    callButton.addEventListener(
        "click",
        async () => {

            if (!client) {

                console.warn(
                    "SignalWire client is not ready."
                );

                status.textContent =
                    "Connecting...";

                const ready =
                    await initializeSignalWire();

                if (!ready) {
                    status.textContent =
                        "Connection failed";
                    return;
                }

            }


            const number =
                phoneNumber.value.trim();


            if (!number) {

                alert(
                    "Please enter a phone number."
                );

                return;

            }


            if (!customerAccount) {

                alert(
                    "Customer account is not ready yet."
                );

                return;

            }


            console.log(
                "📞 Preparing SignalWire outbound call to:",
                number
            );


            callButton.disabled =
                true;

            hangupButton.disabled =
                false;

            status.textContent =
                "Authorizing call...";


            try {

                // -----------------------------------------
                // AUTHORIZE CALL WITH SERVER
                // -----------------------------------------

                const authorizationResponse =
                    await authFetch(
                        "/api/outbound-call/authorize",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
    destinationNumber:
        number,
    callerNumber:
        customerAccount.phoneNumber ||
        ""
})
                        }
                    );


                const authorizationData =
                    await authorizationResponse.json();


                if (
                    !authorizationResponse.ok ||
                    !authorizationData.success
                ) {

                    throw new Error(
                        authorizationData.error ||
                        "Call authorization failed."
                    );

                }


                currentOutboundUsageId =
                    authorizationData.usage_id ||
                    authorizationData.usageId ||
                    null;


                console.log(
                    "✅ Outbound call authorized.",
                    currentOutboundUsageId
                );


                // -----------------------------------------
                // START SIGNALWIRE CALL
                // -----------------------------------------

                status.textContent =
                    "Calling...";


                console.log(
                    "📞 Dialing with SignalWire..."
                );


                currentCall =
                    await client.dial(
                        number,
                        {
                            audio: true,
                            video: false
                        }
                    );
                    const providerCallId =
    currentCall?.id ||
    currentCall?.callId ||
    currentCall?.call_id ||
    null;

console.log(
    "🔗 SignalWire Provider Call ID:",
    providerCallId
);
let recordingStarted = false;
if (currentCall && currentCall.remoteStream$) {

    currentCall.remoteStream$.subscribe(async (stream) => {

        console.log("🔊 SignalWire remote audio stream received.");
        console.log("🔊 Remote stream object:", stream);
console.log("🔊 Remote stream tracks:", stream?.getTracks?.());
console.log(
    "🔊 Remote audio tracks:",
    stream?.getAudioTracks?.()
);
const audioTracks = stream?.getAudioTracks?.() || [];

audioTracks.forEach((track) => {
    console.log("🎧 Audio track:", {
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        label: track.label
    });
});

        let remoteAudio =
    document.getElementById("signalWireRemoteAudio");

if (!remoteAudio) {

    remoteAudio =
        document.createElement("audio");

    remoteAudio.id =
        "signalWireRemoteAudio";

    remoteAudio.autoplay = true;
    remoteAudio.playsInline = true;
    remoteAudio.controls = false;

    document.body.appendChild(remoteAudio);
}

remoteAudio.muted = false;
remoteAudio.volume = 1.0;

        remoteAudio.srcObject =
            stream;

        try {
            await remoteAudio.play();

            console.log(
                "🔊 SignalWire remote audio playing."
            );
        } catch (error) {

            console.error(
                "❌ Could not play remote SignalWire audio:",
                error
            );

        }

    });

}
                console.log(
                    "✅ SignalWire outbound call created.",
                    currentCall
                );


                // -----------------------------------------
                // LISTEN FOR CALL STATUS
                // -----------------------------------------

                if (
                    currentCall &&
                    currentCall.status$
                ) {

                    currentCall.status$.subscribe(
                        async callStatus => {

                            console.log(
                                "📡 SignalWire call status:",
                                callStatus
                            );


                            let statusValue =
                                typeof callStatus ===
                                "string"
                                    ? callStatus
                                    : callStatus?.status ||
                                      callStatus?.state ||
                                      "";


                            statusValue =
                                String(
                                    statusValue
                                ).toLowerCase();


                            // -----------------------------
                            // RINGING / TRYING
                            // -----------------------------

                            if (
                                statusValue === "trying" ||
                                statusValue === "ringing" ||
                                statusValue === "new"
                            ) {

                                status.textContent =
                                    "Calling...";

                            }


                            // -----------------------------
                            // ANSWERED
                            // -----------------------------

                            else if (
    statusValue ===
        "connected" ||
    statusValue ===
        "answered" ||
    statusValue ===
        "active"
) {

                                console.log(
                                    "✅ Call answered."
                                );

                                status.textContent =
                                    "Connected";

                                startCallTimer();
                               
// -----------------------------------------
// TEMPORARY SIGNALWIRE RECORDING TEST
// -----------------------------------------

try {
    if (currentCall && typeof currentCall.record === "function") {
        console.log("🎙️ Starting SignalWire recording test...");

        const recording = await currentCall.record({
            direction: "both"
        });

        console.log("🎙️ SIGNALWIRE RECORDING RESULT:", recording);

        window.currentSignalWireRecording = recording;
    } else {
        console.error("❌ currentCall.record() is not available.");
    }
} catch (recordingError) {
    console.error("❌ SignalWire recording test failed:", recordingError);
}

                                if (
                                    currentOutboundUsageId
                                ) { // -----------------------------------------
// START SIGNALWIRE NATIVE RECORDING
// -----------------------------------------

try {
    if (
        currentCall &&
        typeof currentCall.recordAudio === "function"
    ) {
        console.log("🎙️ Starting native SignalWire recording...");

        const recording = await currentCall.recordAudio({
            direction: "both",
            endSilenceTimeout: 0,
            terminators: ""
        });

        console.log(
            "🎙️ SignalWire recording started:",
            recording
        );

        window.currentSignalWireRecording = recording;

        console.log(
            "🎙️ Recording ID:",
            recording?.id
        );
    } else {
        console.error(
            "❌ currentCall.recordAudio() is not available."
        );
    }
} catch (recordingError) {
    console.error(
        "❌ Native SignalWire recording failed:",
        recordingError
    );
}

                                    await authFetch(
                                        "/api/outbound-call/update",
                                        {
                                            method: "PATCH",

                                            headers: {
                                                "Content-Type":
                                                    "application/json"
                                            },

                                            body:
                                                JSON.stringify({
                                                    usageId:
                                                        currentOutboundUsageId,

                                                    call_status:
                                                        "answered",

                                                    answered:
                                                        true,

                                                    answered_at:
                                                        new Date().toISOString()
                                                })
                                        }
                                    );

                                }

                            }


                            // -----------------------------
                            // ENDING / ENDED
                            // -----------------------------

                            else if (
    statusValue === "ending" ||
    statusValue === "ended" ||
    statusValue === "hangup" ||
    statusValue === "disconnected" ||
    statusValue === "destroyed"
)  {

                                console.log(
                                    "📴 SignalWire call ended."
                                );

                                status.textContent =
                                    "Call ended";

                                stopCallTimer();

                                callButton.disabled =
                                    false;

                                hangupButton.disabled =
                                    true;


                                if (
                                    currentOutboundUsageId
                                ) {

                                    await authFetch(
                                        "/api/outbound-call/update",
                                        {
                                            method: "POST",

                                            headers: {
                                                "Content-Type":
                                                    "application/json"
                                            },

                                            body:
                                                JSON.stringify({
                                                    usageId:
                                                        currentOutboundUsageId,

                                                    call_status:
                                                        "completed",

                                                    ended_at:
                                                        new Date().toISOString()
                                                })
                                        }
                                    );

                                }


                                currentCall =
                                    null;

                                currentOutboundUsageId =
                                    null;

                            }

                        }
                    );

                }

            } catch (error) {

                console.error(
                    "❌ SignalWire outbound call error:",
                    error
                );


                status.textContent =
                    error.message ||
                    "Call failed";


                callButton.disabled =
                    false;

                hangupButton.disabled =
                    true;


                currentCall =
                    null;


                currentOutboundUsageId =
                    null;

            }

        }
    );

}
// =========================================================
// HANG UP
// =========================================================

hangupButton.addEventListener(
    "click",
    async () => {

        if (!currentCall) {
            return;
        }

        console.log(
            "📴 Hanging up SignalWire call..."
        );

        try {

            if (typeof currentCall.hangup === "function") {

                await currentCall.hangup();

            } else if (typeof currentCall.disconnect === "function") {

                await currentCall.disconnect();

            } else {

                console.warn(
                    "⚠️ SignalWire call has no hangup/disconnect method.",
                    currentCall
                );

            }

            console.log(
                "✅ SignalWire hangup requested."
            );

        } catch (error) {

            console.error(
                "❌ SignalWire hangup error:",
                error
            );

        }

        status.textContent =
            "Call ended";

        callButton.disabled =
            false;

        hangupButton.disabled =
            true;

        stopCallTimer();

        currentCall =
            null;

    }
);


// =========================================================
// OPEN MESSAGES
// =========================================================

if (messagesCard) {

    messagesCard.addEventListener(
        "click",
        () => {

            openMessages();

        }
    );

}


// =========================================================
// CLOSE MESSAGES
// =========================================================

if (closeMessagesButton) {

    closeMessagesButton.addEventListener(
        "click",
        () => {

            closeMessages();

        }
    );

}


// =========================================================
// CLICK OUTSIDE MESSAGES
// =========================================================

if (messagesOverlay) {

    messagesOverlay.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                messagesOverlay
            ) {

                closeMessages();

            }

        }
    );

}


// =========================================================
// OPEN MESSAGE WINDOW
// =========================================================

function openMessages() {

    if (!messagesOverlay) {
        return;
    }


    if (!customerAccount) {

        alert(
            "Customer account is not ready yet."
        );

        return;

    }


    messagesOverlay.classList.add(
        "open"
    );


    if (
        customerAccount &&
        messagesBusinessNumber
    ) {

        const number =
            customerAccount.phoneNumber ||
            customerAccount.telnyxPhoneNumber ||
            "";


        messagesBusinessNumber.textContent =
            number
                ? "From " +
                  formatPhoneNumber(number)
                : "Number unavailable";

    }


    messageRecipient.focus();


    startMessagePolling();

}


// =========================================================
// CLOSE MESSAGE WINDOW
// =========================================================

function closeMessages() {

    if (!messagesOverlay) {
        return;
    }


    messagesOverlay.classList.remove(
        "open"
    );


    stopMessagePolling();

}


// =========================================================
// MESSAGE RECIPIENT CHANGE
// =========================================================

if (messageRecipient) {

    messageRecipient.addEventListener(
        "input",
        () => {

            renderConversation();

        }
    );


    messageRecipient.addEventListener(
        "blur",
        () => {

            const normalized =
                normalizePhoneNumber(
                    messageRecipient.value
                );


            if (normalized) {

                messageRecipient.value =
                    normalized;


                renderConversation();

            }

        }
    );

}


// =========================================================
// MESSAGE CHARACTER COUNT
// =========================================================

if (messageText) {

    messageText.addEventListener(
        "input",
        updateMessageCharacterCount
    );

}


function updateMessageCharacterCount() {

    if (
        !messageText ||
        !messageCharacterCount
    ) {
        return;
    }


    const text =
        messageText.value.trim();


    messageCharacterCount.textContent =
        messageText.value.length +
        " / 1600";


    if (sendMessageButton) {

        sendMessageButton.disabled =
            text.length === 0;

    }

}


// =========================================================
// SEND MESSAGE BUTTON
// =========================================================

if (sendMessageButton) {

    sendMessageButton.addEventListener(
        "click",
        sendMessage
    );

}


// =========================================================
// ENTER TO SEND
// =========================================================

if (messageText) {

    messageText.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );

}


// =========================================================
// SEND SMS
// =========================================================

async function sendMessage() {

    if (!customerAccount) {

        alert(
            "Customer account is not ready yet."
        );

        return;

    }


    const rawRecipient =
        messageRecipient.value.trim();


    const text =
        messageText.value.trim();


    if (!rawRecipient) {

        alert(
            "Please enter a phone number."
        );

        messageRecipient.focus();

        return;

    }


    if (!text) {

        alert(
            "Please type a message."
        );

        messageText.focus();

        return;

    }


    if (
        text.length > 1600
    ) {

        alert(
            "Message is too long."
        );

        return;

    }


    const recipient =
        normalizePhoneNumber(
            rawRecipient
        );


    if (
        !recipient.startsWith("+") ||
        recipient.length < 10
    ) {

        alert(
            "Please enter a valid phone number."
        );

        return;

    }


    try {

        sendMessageButton.disabled =
            true;


        sendMessageButton.innerHTML =
            "Sending...";


        const response =
            await authFetch(
                "/api/messages/send",
                {

                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            to:
                                recipient,

                            text:
                                text

                        })

                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                data.message ||
                "Message could not be sent"
            );

        }


        // =================================================
        // ADD TO LOCAL CACHE
        // =================================================

        localMessages.push({

            id:
                data.message?.id ||
                `local-${Date.now()}`,

            direction:
                "outbound",

            from:
                customerAccount.phoneNumber,

            to:
                recipient,

            text:
                text,

            timestamp:
                new Date().toISOString(),

            status:
                "sent"

        });


        localMessages =
            localMessages.slice(
                -500
            );


        saveLocalMessages();


        messageText.value =
            "";


        updateMessageCharacterCount();


        messageRecipient.value =
            recipient;


        renderConversation();


        console.log(
            "SMS sent:",
            data.message
        );

    }


    catch (error) {

        console.error(
            "SMS sending error:",
            error
        );


        alert(
            "Could not send message.\n\n" +
            error.message
        );

    }


    finally {

        sendMessageButton.disabled =
            false;


        sendMessageButton.innerHTML =
            "<span>➤</span> Send";

    }

}


// =========================================================
// FETCH SERVER MESSAGES
// =========================================================

async function fetchMessages() {

    if (!customerAccount) {
        return;
    }


    const recipient =
        normalizePhoneNumber(
            messageRecipient?.value
        );


    if (!recipient) {
        return;
    }


    try {

        const response =
            await authFetch(
                "/api/messages?phone=" +
                encodeURIComponent(
                    recipient
                )
            );


        if (!response.ok) {

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                console.warn(
                    "Authentication required for messages."
                );

            }


            return;

        }


        const data =
            await response.json();


        if (
            !data.success ||
            !Array.isArray(
                data.messages
            )
        ) {

            return;

        }


        // =================================================
        // MERGE SERVER MESSAGES
        // =================================================

        let changed =
            false;


        data.messages.forEach(
            serverMessage => {

                const exists =
                    localMessages.some(
                        localMessage =>
                            localMessage.id ===
                            serverMessage.id
                    );


                if (!exists) {

                    localMessages.push(
                        serverMessage
                    );

                    changed =
                        true;

                }

            }
        );


        if (changed) {

            localMessages =
                localMessages.slice(
                    -500
                );


            saveLocalMessages();

        }


        renderConversation();

    }


    catch (error) {

        console.error(
            "Message polling error:",
            error
        );

    }

}


// =========================================================
// RENDER CONVERSATION
// =========================================================

function renderConversation() {

    if (!messagesConversation) {
        return;
    }


    if (!customerAccount) {

        messagesConversation.innerHTML = `
            <div class="messages-empty">
                Account not available.
            </div>
        `;

        return;

    }


    const recipient =
        normalizePhoneNumber(
            messageRecipient?.value
        );


    if (!recipient) {

        messagesConversation.innerHTML = `
            <div class="messages-empty">
                Enter a phone number to start messaging.
            </div>
        `;

        return;

    }


    const customerPhone =
        normalizePhoneNumber(
            customerAccount.phoneNumber
        );


    const conversation =
        localMessages
            .filter(
                message => {

                    const from =
                        normalizePhoneNumber(
                            message.from
                        );


                    const to =
                        normalizePhoneNumber(
                            message.to
                        );


                    return (

                        (
                            from ===
                            recipient &&

                            to ===
                            customerPhone
                        )

                        ||

                        (
                            to ===
                            recipient &&

                            from ===
                            customerPhone
                        )

                    );

                }
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    new Date(
                        a.timestamp ||
                        a.createdAt
                    ) -

                    new Date(
                        b.timestamp ||
                        b.createdAt
                    )
            );


    if (
        conversation.length === 0
    ) {

        messagesConversation.innerHTML = `
            <div class="messages-empty">
                No messages yet.<br>
                Send the first message.
            </div>
        `;

        return;

    }


    messagesConversation.innerHTML =
        "";


    conversation.forEach(
        message => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "message-row " +
                (
                    message.direction ===
                    "outbound"
                        ? "outbound"
                        : "inbound"
                );


            const bubble =
                document.createElement(
                    "div"
                );


            bubble.className =
                "message-bubble";


            const text =
                document.createElement(
                    "div"
                );


            text.textContent =
                message.text ||
                "";


            const meta =
                document.createElement(
                    "div"
                );


            meta.className =
                "message-meta";


            meta.textContent =
                formatTime(
                    message.timestamp ||
                    message.createdAt
                );


            bubble.appendChild(
                text
            );


            bubble.appendChild(
                meta
            );


            row.appendChild(
                bubble
            );


            messagesConversation.appendChild(
                row
            );

        }
    );


    // Scroll to bottom

    messagesConversation.scrollTop =
        messagesConversation.scrollHeight;

}


// =========================================================
// MESSAGE POLLING
// =========================================================

function startMessagePolling() {

    stopMessagePolling();


    fetchMessages();


    messagePollingInterval =
        setInterval(
            fetchMessages,
            3000
        );

}


function stopMessagePolling() {

    if (
        messagePollingInterval
    ) {

        clearInterval(
            messagePollingInterval
        );


        messagePollingInterval =
            null;

    }

}


// =========================================================
// AUTH STATE LISTENER
// =========================================================

supabase.auth.onAuthStateChange(
    (
        event,
        session
    ) => {

        console.log(
            "Supabase auth event:",
            event
        );

        if (
            event ===
            "SIGNED_OUT"
        ) {

            currentUserId =
                null;

            customerAccount =
                null;

            client =
                null;

            stopMessagePolling();

            stopCallTimer();

            if (callButton) {
                callButton.disabled = true;
            }

            if (hangupButton) {
                hangupButton.disabled = true;
            }

            if (sendMessageButton) {
                sendMessageButton.disabled = true;
            }

            if (userName) {
                userName.textContent =
                    "Signed out";
            }

            if (businessNumber) {
                businessNumber.textContent =
                    "Number unavailable";
            }

            if (messagesBusinessNumber) {
                messagesBusinessNumber.textContent =
                    "Number unavailable";
            }

            status.textContent =
                "Signed out";
        }
    }
);


// =========================================================
// INITIALIZE APP
// =========================================================

async function initializeApp() {

    console.log(
        "Initializing Dialeaze..."
    );

    const accountLoaded =
        await loadCustomerAccount();

    if (!accountLoaded) {

        console.error(
            "Dialeaze could not authenticate the user."
        );

        return;
    }

    await initializeSignalWire();
}


// =========================================================
// START DIALEAZE APPLICATION
// =========================================================

initializeApp();