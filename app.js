// @ts-nocheck

"use strict";

document.addEventListener("DOMContentLoaded", function () {

    const BACKEND_URL = "http://localhost:3000";

    const sidebar = document.getElementById("sidebar");
    const menuButton = document.getElementById("menuButton");
    const headerTitle = document.getElementById("headerTitle");
    const newChatButton = document.getElementById("newChat");

    const messageInput =
        document.getElementById("messageInput");

    const sendButton =
        document.getElementById("sendButton");

    const messages =
        document.getElementById("messages");

    const videoInput =
        document.getElementById("videoInput");

    const navItems =
        document.querySelectorAll(".nav-item");

    const pages =
        document.querySelectorAll(".page");

    const suggestions =
        document.querySelectorAll(".suggestions button");

    const primaryButtons =
        document.querySelectorAll(".primary-button");


    const pageTitles = {
        chat: "Chat",
        writer: "Writer",
        coder: "Coder",
        translate: "Translate",
        image: "Image",
        voice: "Voice",
        video: "Video",
        recap: "Video Recap"
    };


    /* =========================
       PAGE NAVIGATION
    ========================= */

    function openPage(pageName) {

        pages.forEach(function (page) {
            page.classList.remove("active");
        });

        navItems.forEach(function (item) {
            item.classList.remove("active");
        });

        const selectedPage =
            document.getElementById(
                "page-" + pageName
            );

        const selectedNav =
            document.querySelector(
                '.nav-item[data-page="' +
                pageName +
                '"]'
            );

        if (selectedPage) {
            selectedPage.classList.add("active");
        }

        if (selectedNav) {
            selectedNav.classList.add("active");
        }

        if (
            headerTitle &&
            pageTitles[pageName]
        ) {
            headerTitle.textContent =
                pageTitles[pageName];
        }

        if (sidebar) {
            sidebar.classList.remove("open");
        }
    }


    navItems.forEach(function (item) {

        item.addEventListener(
            "click",
            function () {

                const pageName =
                    item.getAttribute(
                        "data-page"
                    );

                if (pageName) {
                    openPage(pageName);
                }
            }
        );
    });


    /* =========================
       MOBILE MENU
    ========================= */

    if (menuButton && sidebar) {

        menuButton.addEventListener(
            "click",
            function () {

                sidebar.classList.toggle(
                    "open"
                );
            }
        );
    }


    /* =========================
       NEW CHAT
    ========================= */

    if (
        newChatButton &&
        messages &&
        messageInput
    ) {

        newChatButton.addEventListener(
            "click",
            function () {

                while (messages.firstChild) {
                    messages.removeChild(
                        messages.firstChild
                    );
                }

                messageInput.value = "";

                messageInput.style.height =
                    "auto";

                openPage("chat");

                messageInput.focus();
            }
        );
    }


    /* =========================
       ADD MESSAGE
    ========================= */

    function addMessage(type, text) {

        if (!messages) {
            return;
        }

        const message =
            document.createElement("div");

        message.className =
            "message " + type;


        const avatar =
            type === "user"
                ? "S"
                : "SS";


        const name =
            type === "user"
                ? "You"
                : "SUN SPY AI";


        const avatarElement =
            document.createElement("div");

        avatarElement.className =
            "message-avatar";

        avatarElement.textContent =
            avatar;


        const body =
            document.createElement("div");

        body.className =
            "message-body";


        const nameElement =
            document.createElement("div");

        nameElement.className =
            "message-name";

        nameElement.textContent =
            name;


        const textElement =
            document.createElement("div");

        textElement.className =
            "message-text";

        textElement.textContent =
            text;


        body.appendChild(
            nameElement
        );

        body.appendChild(
            textElement
        );


        message.appendChild(
            avatarElement
        );

        message.appendChild(
            body
        );


        messages.appendChild(
            message
        );


        message.scrollIntoView({
            behavior: "smooth",
            block: "end"
        });
    }


    /* =========================
       BACKEND CONNECTION
    ========================= */

    async function sendToBackend(text) {

        const response =
            await fetch(
                BACKEND_URL +
                "/api/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        message: text
                    })
                }
            );


        if (!response.ok) {
            throw new Error(
                "Backend request failed"
            );
        }


        const data =
            await response.json();


        if (!data.reply) {
            throw new Error(
                "Invalid backend response"
            );
        }


        return data.reply;
    }


    /* =========================
       SEND MESSAGE
    ========================= */

    async function sendMessage() {

        if (
            !messageInput ||
            !sendButton
        ) {
            return;
        }


        const text =
            messageInput.value.trim();


        if (!text) {
            return;
        }


        addMessage(
            "user",
            text
        );


        messageInput.value = "";

        messageInput.style.height =
            "auto";


        sendButton.disabled =
            true;


        sendButton.textContent =
            "…";


        try {

            const reply =
                await sendToBackend(
                    text
                );


            addMessage(
                "ai",
                reply
            );


        } catch (error) {

            addMessage(
                "ai",
                "SUN SPY AI backend ကို ချိတ်ဆက်လို့ မရသေးပါ။ Backend server ကို စစ်ပေးပါ။"
            );

        } finally {

            sendButton.disabled =
                false;

            sendButton.textContent =
                "↑";

            messageInput.focus();
        }
    }


    /* =========================
       SEND BUTTON
    ========================= */

    if (sendButton) {

        sendButton.addEventListener(
            "click",
            sendMessage
        );
    }


    /* =========================
       ENTER TO SEND
    ========================= */

    if (messageInput) {

        messageInput.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    sendMessage();
                }
            }
        );


        messageInput.addEventListener(
            "input",
            function () {

                messageInput.style.height =
                    "auto";


                messageInput.style.height =
                    Math.min(
                        messageInput
                            .scrollHeight,
                        150
                    ) + "px";
            }
        );
    }


    /* =========================
       QUICK SUGGESTIONS
    ========================= */

    suggestions.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const prompt =
                        button.getAttribute(
                            "data-prompt"
                        );


                    if (
                        !messageInput ||
                        !prompt
                    ) {
                        return;
                    }


                    messageInput.value =
                        prompt;


                    messageInput.focus();
                }
            );
        }
    );


    /* =========================
       TOOL BUTTONS
    ========================= */

    primaryButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const tool =
                        button.closest(
                            ".tool"
                        );


                    if (!tool) {
                        return;
                    }


                    const input =
                        tool.querySelector(
                            ".tool-input"
                        );


                    if (
                        input &&
                        input.value.trim() === ""
                    ) {

                        input.focus();

                        return;
                    }


                    const originalText =
                        button.textContent;


                    button.textContent =
                        "Processing...";


                    button.disabled =
                        true;


                    window.setTimeout(
                        function () {

                            button.textContent =
                                originalText;


                            button.disabled =
                                false;

                        },
                        800
                    );
                }
            );
        }
    );


    /* =========================
       VIDEO UPLOAD
    ========================= */

    if (videoInput) {

        videoInput.addEventListener(
            "change",
            function () {

                const file =
                    videoInput.files &&
                    videoInput.files[0];


                if (!file) {
                    return;
                }


                const upload =
                    videoInput.closest(
                        ".upload"
                    );


                if (!upload) {
                    return;
                }


                const title =
                    upload.querySelector(
                        "strong"
                    );


                if (title) {

                    title.textContent =
                        file.name;
                }
            }
        );
    }


    /* =========================
       START APP
    ========================= */

    openPage("chat");

});