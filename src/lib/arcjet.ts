import arcjet, { detectBot, shield, tokenBucket } from "@arcjet/node";

export const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({ mode: "LIVE", allow: ["JAVASCRIPT_AXIOS"] }),
  ],
});

export const ajGenerate = arcjet({
  key: process.env.ARCJET_KEY!,
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({ mode: "LIVE", allow: ["JAVASCRIPT_AXIOS"] }),
    tokenBucket({ mode: "LIVE", refillRate: 5, interval: 60, capacity: 10 }),
  ],
});
