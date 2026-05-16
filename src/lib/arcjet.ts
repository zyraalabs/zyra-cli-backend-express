import arcjet, { detectBot, shield, tokenBucket } from "@arcjet/node";

export const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({ mode: "LIVE", allow: [] }),
  ],
});

export const ajGenerate = arcjet({
  key: process.env.ARCJET_KEY!,
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({ mode: "LIVE", allow: [] }),
    tokenBucket({ mode: "LIVE", refillRate: 5, interval: 60, capacity: 10 }),
  ],
});
