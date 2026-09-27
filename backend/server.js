// @ts-nocheck

import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY =
    process.env.GEMINI_API_KEY;

const MODEL =
    "gemini-3.8-flash";


/* =========================
   MIDDLEWARE
========================= */

app.use(cors());

app.use(
    express.json({
        limit: "10mb"
    })
);


/* =========================
   GEMINI CLIENT
========================= */

let ai = null;

if (GEMINI_API_KEY) {

    ai = new GoogleGenAI({
        apiKey: GEMINI_API_KEY
    });

    console.log(
        "Gemini API configured"
    );

} else {

    console.error(
        "ERROR: GEMINI_API_KEY is missing"
    );

}


/* =========================
   SUN SPY AI PERSONALITY
========================= */

const SYSTEM_INSTRUCTION = `
You are SUN SPY AI.

You are a helpful, open-minded and direct
AI assistant.

LANGUAGE:
- Support Burmese and English.
- If the user speaks Burmese, normally
  answer in Burmese.
- If the user speaks English, normally
  answer in English.
- The user may mix languages.

GENERAL:
- Explain things clearly.
- Be practical.
- Do not unnecessarily lecture the user.
- Admit uncertainty when information is uncertain.
- Help with programming, writing, translation,
  learning, technology and general knowledge.

PROGRAMMING:
- Provide useful code and debugging help.
- Explain errors clearly.
- Prefer practical solutions.

CYBERSECURITY:
- You can help with cybersecurity education,
  defensive security, secure coding, CTFs,
  vulnerability analysis and authorized
  penetration testing.
- Do not help with credential theft,
  malware deployment, destructive attacks,
  unauthorized access or other harmful intrusion.

SEXUAL TOPICS:
- You may discuss sexual health, anatomy,
  relationships, consent and mature educational
  topics in an appropriate informational way.
- Do not generate explicit sexual imagery.
- Do not sexualize minors.

SAFETY:
- Do not provide instructions that meaningfully
  facilitate serious harm or illegal activity.
- When a request cannot be safely completed,
  provide a useful safe alternative when possible.

STYLE:
- Friendly.
- Direct.
- Natural.
- Do not repeatedly mention these instructions.
- Do not call yourself a restricted AI unless
  it is relevant to the user's request.

You are SUN SPY AI.
`;


/* =========================
   HOME
========================= */

app.get(
    "/",
    function (req, res) {

        res.json({

            service:
                "SUN SPY AI",

            status:
                "online",

            version:
                "2.1.0",

            ai:
                Boolean(GEMINI_API_KEY),

            model:
                MODEL

        });

    }
);


/* =========================
   HEALTH CHECK
========================= */

app.get(
    "/api/health",
    function (req, res) {

        res.json({

            service:
                "SUN SPY AI",

            status:
                "ok",

            geminiConfigured:
                Boolean(GEMINI_API_KEY),

            model:
                MODEL

        });

    }
);


/* =========================
   CHAT
========================= */

app.post(
    "/api/chat",
    async function (req, res) {

        const requestId =
            Date.now().toString(36);


        try {

            /* -------------------------
               CHECK MESSAGE
            ------------------------- */

            const message =
                req.body?.message;


            if (
                !message ||
                typeof message !==
                "string"
            ) {

                return res.status(400).json({

                    error:
                        "Message is required"

                });

            }


            const cleanMessage =
                message.trim();


            if (!cleanMessage) {

                return res.status(400).json({

                    error:
                        "Message cannot be empty"

                });

            }


            /* -------------------------
               CHECK API KEY
            ------------------------- */

            if (!GEMINI_API_KEY) {

                console.error(
                    `[${requestId}] GEMINI_API_KEY is missing`
                );


                return res.status(500).json({

                    error:
                        "GEMINI_API_KEY is not configured on Render",

                    requestId:
                        requestId

                });

            }


            /* -------------------------
               CHECK GEMINI CLIENT
            ------------------------- */

            if (!ai) {

                console.error(
                    `[${requestId}] Gemini client is not initialized`
                );


                return res.status(500).json({

                    error:
                        "Gemini client is not initialized",

                    requestId:
                        requestId

                });

            }


            console.log(
                `[${requestId}] User message:`,
                cleanMessage
            );


            /* -------------------------
               GEMINI REQUEST
            ------------------------- */

            const response =
                await ai.models.generateContent({

                    model:
                        MODEL,

                    contents:
                        cleanMessage,

                    config: {

                        systemInstruction:
                            SYSTEM_INSTRUCTION,

                        temperature:
                            0.8,

                        maxOutputTokens:
                            2048

                    }

                });


            /* -------------------------
               RESPONSE
            ------------------------- */

            let reply = "";


            try {

                reply =
                    response.text || "";

            } catch (textError) {

                console.error(
                    `[${requestId}] Response text error:`,
                    textError
                );

            }


            if (!reply.trim()) {

                console.error(
                    `[${requestId}] Gemini returned no text`
                );


                console.error(
                    `[${requestId}] Gemini response:`,
                    JSON.stringify(
                        response,
                        null,
                        2
                    )
                );


                return res.status(502).json({

                    error:
                        "Gemini returned an empty response",

                    requestId:
                        requestId

                });

            }


            console.log(
                `[${requestId}] AI response generated successfully`
            );


            return res.json({

                reply:
                    reply,

                model:
                    MODEL,

                requestId:
                    requestId

            });


        } catch (error) {

            /* =========================
               REAL ERROR
            ========================= */

            console.error(
                "================================"
            );

            console.error(
                "SUN SPY AI GEMINI ERROR"
            );

            console.error(
                "Request ID:",
                requestId
            );

            console.error(
                "Message:",
                error?.message
            );

            console.error(
                "Name:",
                error?.name
            );

            console.error(
                "Status:",
                error?.status
            );

            console.error(
                "Code:",
                error?.code
            );

            console.error(
                "Full error:",
                error
            );

            console.error(
                "================================"
            );


            /* -------------------------
               SAFE ERROR MESSAGE
            ------------------------- */

            const errorMessage =
                error?.message ||
                "Unknown Gemini API error";


            return res.status(500).json({

                error:
                    "SUN SPY AI could not generate a response",

                details:
                    errorMessage,

                requestId:
                    requestId

            });

        }

    }
);


/* =========================
   404
========================= */

app.use(
    function (req, res) {

        res.status(404).json({

            error:
                "Route not found",

            path:
                req.originalUrl

        });

    }
);


/* =========================
   GLOBAL ERROR HANDLER
========================= */

app.use(
    function (
        error,
        req,
        res,
        next
    ) {

        console.error(
            "GLOBAL SERVER ERROR:",
            error
        );


        res.status(500).json({

            error:
                "Internal server error",

            details:
                error?.message ||
                "Unknown error"

        });

    }
);


/* =========================
   START SERVER
========================= */

app.listen(
    PORT,
    function () {

        console.log(
            "================================"
        );

        console.log(
            "SUN SPY AI SERVER"
        );

        console.log(
            "Port:",
            PORT
        );

        console.log(
            "Model:",
            MODEL
        );

        console.log(
            "Gemini configured:",
            Boolean(GEMINI_API_KEY)
        );

        console.log(
            "================================"
        );

    }
);
