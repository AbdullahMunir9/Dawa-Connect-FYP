import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const systemInstruction = `You interpret what a user SAID aloud about medicines or pharmacy products.

Your task: infer the best SHORT search phrase for our medicine marketplace (medicine names, generics, OTC products, doses if mentioned).

Rules:
- Output ONLY compact JSON with a single string field "query".
- Example: {"query":"paracetamol 500"}
- Prefer drug/product names over conversational filler ("please find me aspirin" → {"query":"aspirin"})
- If they ask for vague categories, use concise category keywords ({"query":"cough syrup children"})
- If there is clearly no pharmacy/medicine intent, {"query":""}.
- Maximum ~80 characters in query. ASCII preferred; keep brand spellings reasonable.
- No markdown, no code fences, no explanation — JSON object only.`;

function safeParseIntent(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.query === "string") return parsed.query.trim();
    return "";
  } catch {
    const m = text.match(/\{"query"\s*:\s*"([^"]*)"\s*\}/);
    if (m) return m[1].trim();
    return text.replace(/^["']|["']$/g, "").slice(0, 120).trim();
  }
}

export async function POST(req) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ message: "Voice intent is not configured" }, { status: 503 });
    }

    const { transcript } = await req.json();
    const trimmed = String(transcript ?? "").trim();

    if (!trimmed) {
      return NextResponse.json({ query: "", message: "Missing transcript" }, { status: 400 });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.15,
      max_tokens: 120,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: trimmed },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const query = safeParseIntent(raw);

    return NextResponse.json({ query });
  } catch (error) {
    console.error("voice-search-intent:", error);
    return NextResponse.json(
      { message: error.message || "Failed to parse speech intent" },
      { status: 500 }
    );
  }
}
