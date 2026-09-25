// @ts-nocheck

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", function (req, res) {
    res.json({
        service: "SUN SPY AI",
        status: "online"
    });
});

app.post("/api/chat", function (req, res) {

    const message = req.body.message;

    if (!message) {
        return res.status(400).json({
            error: "Message is required"
        });
    }

    res.json({
        reply: "SUN SPY AI backend received: " + message
    });
});

app.listen(PORT, function () {
    console.log("SUN SPY AI running on port " + PORT);
});
