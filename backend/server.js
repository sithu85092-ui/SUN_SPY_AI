// @ts-nocheck

import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();

const PORT = process.env.PORT || 3000;

const API_KEY = process.env.GEMINI_API_KEY;

const MODEL = "gemini-3.8-flash";


app.use(cors());

app.use(
    express.json({
        limit: "10mb"
    })
);


let ai = null;

if (API_KEY) {

    ai = new GoogleGenAI({
        apiKey: API_KEY
    });

    console.log("Gemini API configured");

} else {

    console.error(
        "GEMINI_API_KEY is missing"
    );

}


const SYSTEM_INSTRUCTION = `
You are SUN SPY AI.

You are a helpful, open-minded and direct AI assistant.

Support Burmese and English.

If the user speaks Burmese,
answer naturally in Burmese.

Help with:
- General questions
- Programming
- Coding
- Writing
- Translation
- Technology
- Education
- Cybersecurity education
- Ethical hacking
- Sexual health and relationship education

For cybersecurity, help with authorized,
defensive and educational security work.

Do not help with credential theft,
malware deployment, destructive attacks,
or unauthorized intrusion.

For sexual topics, you may discuss
sexual health, anatomy, relationships,
consent and mature educational topics.

Do not generate explicit sexual imagery
or sexual content involving minors.

Be natural, useful and direct.
`;


/* =========================
   HOME
========================= */

app.get("/", function (req, res) {

    res.json({

        service: "SUN SPY AI",

        status: "online",

        version: "2.2.0",

        ai: Boolean(API_KEY),

        model: MODEL

    });

});


/* =========================
   HEALTH
========================= */

app.get("/api/health", function (req, res) {

    res.json({

        service: "SUN SPY AI",

        status: "ok",

        geminiConfigured:
            Boolean(API_KEY),

        model: MODEL

    });

});


/* =========================
   CHAT
========================= */

app.post(
    "/api/chat",
    async function (req, res) {

        try {

            const message =
                req.body?.message;


            if (
                !message ||
                typeof message !== "string"
            ) {

                return res.status(400).json({

                    error:
                        "Message is required"

                });

            }


            if (!API_KEY) {

                return res.status(500).json({

                    error:
                        "GEMINI_API_KEY is missing"

                });

            }


            if (!ai) {

                return res.status(500).json({

                    error:
                        "Gemini client is not initialized"

                });

            }


            console.log(
                "User:",
                message
            );


            const response =
                await ai.models.generateContent({

                    model: MODEL,

                    contents: message,

                    config: {

                        systemInstruction:
                            SYSTEM_INSTRUCTION,

                        thinkingConfig: {

                            thinkingLevel:
                                "low"

                        }

                    }

                });


            const reply =
                response.text;


            if (!reply) {

                return res.status(502).json({

                    error:
                        "Gemini returned an empty response"

                });

            }


            console.log(
                "Gemini response received"
            );


            return res.json({

                reply: reply,

                model: MODEL

            });


        } catch (error) {

            console.error(
                "========== GEMINI ERROR =========="
            );

            console.error(
                error
            );

            console.error(
                "Message:",
                error?.message
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
                "=================================="
            );


            return res.status(500).json({

                error:
                    "Gemini API error",

                details:
                    error?.message ||
                    String(error)

            });

        }

    }
);


/* =========================
   404
========================= */

app.use(function (req, res) {

    res.status(404).json({

        error:
            "Route not found",

        path:
            req.originalUrl

    });

});


/* =========================
   START
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
            Boolean(API_KEY)
        );

        console.log(
            "================================"
        );

    }
);
