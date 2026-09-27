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
   APP
========================= */

app.use(cors());

app.use(
    express.json({
        limit: "10mb"
    })
);


/* =========================
   GEMINI
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

    console.warn(
        "GEMINI_API_KEY is missing"
    );

}


/* =========================
   SYSTEM INSTRUCTION
========================= */

const SYSTEM_INSTRUCTION = `
You are SUN SPY AI.

You are a helpful, open-minded, direct AI assistant.

Main goals:
- Help users understand things clearly.
- Support Burmese and English.
- Write, translate, explain, summarize and code.
- Help with programming and cybersecurity education.
- Be respectful and non-judgmental.
- Give accurate information.
- When information may be uncertain or outdated, say so.

For cybersecurity:
- Help with defensive security, ethical hacking,
  CTFs, secure coding, vulnerability education
  and systems the user is authorized to test.
- Do not provide instructions that facilitate
  credential theft, malware deployment,
  destructive attacks or unauthorized intrusion.

For sexual topics:
- You may discuss sexual health,
  relationships, consent, anatomy,
  education and mature topics in an
  appropriate informational way.
- Do not generate explicit sexual imagery.

Always answer naturally.
Prefer the user's language when possible.
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
                "2.0.0",

            ai:
                Boolean(GEMINI_API_KEY),

            model:
                MODEL

        });

    }
);


/* =========================
   HEALTH
========================= */

app.get(
    "/api/health",
    function (req, res) {

        res.json({

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

        try {

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


            if (!ai) {

                return res.status(500).json({

                    error:
                        "GEMINI_API_KEY is not configured on the server"

                });

            }


            console.log(
                "User:",
                message
            );


            const response =
                await ai.models.generateContent({

                    model:
                        MODEL,

                    contents:
                        message,

                    config: {

                        systemInstruction:
                            SYSTEM_INSTRUCTION

                    }

                });


            const reply =
                response.text;


            if (!reply) {

                throw new Error(
                    "Gemini returned an empty response"
                );

            }


            console.log(
                "AI:",
                reply
            );


            res.json({

                reply:
                    reply,

                model:
                    MODEL

            });


        } catch (error) {

            console.error(
                "Gemini error:",
                error
            );


            res.status(500).json({

                error:
                    "SUN SPY AI could not generate a response",

                details:
                    error?.message ||
                    "Unknown error"

            });

        }

    }
);


/* =========================
   SERVER
========================= */

app.listen(
    PORT,
    function () {

        console.log(
            "SUN SPY AI running on port " +
            PORT
        );

    }
);
