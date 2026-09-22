import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/mongodb";
import AiUsage from "@/models/AiUsage";
import User from "@/models/User";

const DAILY_QUESTION_LIMIT = 20;
const USAGE_TIMEZONE = process.env.AI_USAGE_TIMEZONE || "Asia/Karachi";
const DEFAULT_MODELS = [
  "openai/gpt-oss-20b",
  "qwen/qwen3.6-27b",
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
];

const configuredModels = (process.env.GROQ_CHAT_MODELS || "")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const uniqueConfiguredModels = [...new Set(configuredModels)];
const CHAT_MODELS =
  uniqueConfiguredModels.length === 4 ? uniqueConfiguredModels : DEFAULT_MODELS;

const systemInstruction = `
You are the DawaConnect Virtual Pharmacist and Medical Assistant.

Your role:
- Help users understand medications.
- Explain common side effects and interactions.
- Guide users on medicine use and the DawaConnect platform.

Safety rules:
- Clearly identify yourself as an AI assistant.
- Provide general educational information, not a diagnosis or prescription.
- Never claim to replace a doctor or pharmacist.
- Encourage the user to verify medication decisions with a licensed professional.
- For emergencies or severe symptoms, tell the user to contact local emergency services immediately.
- Do not invent drug facts. State uncertainty when appropriate.
`;

function getDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: USAGE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getTomorrowReset(date = new Date()) {
  return getDayKey(new Date(date.getTime() + 24 * 60 * 60 * 1000));
}

async function getAuthenticatedUser(req) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token || !process.env.JWT_SECRET) return { error: "unauthenticated" };

  let payload;
  try {
    const key = new TextEncoder().encode(process.env.JWT_SECRET);
    ({ payload } = await jwtVerify(token, key));
    if (!payload.userId) return { error: "unauthenticated" };
  } catch {
    return { error: "unauthenticated" };
  }

  try {
    await connectToDatabase();
    const user = await User.findById(payload.userId).select("_id status").lean();
    if (!user) return { error: "unauthenticated" };
    if (String(user.status || "active").toLowerCase() === "suspended") {
      return { error: "suspended" };
    }
    return { user };
  } catch (error) {
    console.error("AI authentication database check failed:", error);
    return { error: "database_unavailable" };
  }
}

function authErrorResponse(error) {
  if (error === "database_unavailable") {
    return NextResponse.json(
      { message: "The Marketplace database is temporarily unavailable. Please try again shortly." },
      { status: 503 }
    );
  }
  if (error === "suspended") {
    return NextResponse.json(
      { message: "Your account is suspended. Please contact support." },
      { status: 403 }
    );
  }
  return NextResponse.json(
    { message: "Only registered, signed-in Marketplace users can use the AI Assistant." },
    { status: 401 }
  );
}

async function reserveQuestion(userId, dayKey) {
  const filter = { userId, dayKey, count: { $lt: DAILY_QUESTION_LIMIT } };
  let usage = await AiUsage.findOneAndUpdate(
    filter,
    { $inc: { count: 1 } },
    { new: true }
  );
  if (usage) return usage;

  const existing = await AiUsage.findOne({ userId, dayKey }).select("count");
  if (existing) return null;

  try {
    return await AiUsage.create({ userId, dayKey, count: 1 });
  } catch (error) {
    // Simultaneous first requests can race to create the daily document.
    if (error?.code !== 11000) throw error;
    return AiUsage.findOneAndUpdate(filter, { $inc: { count: 1 } }, { new: true });
  }
}

async function releaseQuestion(usageId) {
  await AiUsage.updateOne(
    { _id: usageId, count: { $gt: 0 } },
    { $inc: { count: -1 } }
  );
}

function quotaPayload(count) {
  return {
    limit: DAILY_QUESTION_LIMIT,
    used: count,
    remaining: Math.max(0, DAILY_QUESTION_LIMIT - count),
    day: getDayKey(),
    timezone: USAGE_TIMEZONE,
    resetsOn: getTomorrowReset(),
  };
}

export async function GET(req) {
  const auth = await getAuthenticatedUser(req);
  if (auth.error) return authErrorResponse(auth.error);

  const usage = await AiUsage.findOne({
    userId: auth.user._id,
    dayKey: getDayKey(),
  })
    .select("count")
    .lean();

  return NextResponse.json(quotaPayload(usage?.count || 0));
}

export async function POST(req) {
  const auth = await getAuthenticatedUser(req);
  if (auth.error) return authErrorResponse(auth.error);

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { message: "The AI Assistant is not configured. Set GROQ_API_KEY and restart the app." },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const incomingMessages = body?.messages;
  if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
    return NextResponse.json({ message: "Messages are required." }, { status: 400 });
  }

  const messages = incomingMessages
    .slice(-20)
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim()
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 4000),
    }));

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { message: "The conversation must end with a user question." },
      { status: 400 }
    );
  }

  const usage = await reserveQuestion(auth.user._id, getDayKey());
  if (!usage) {
    return NextResponse.json(
      {
        message: `You have reached your ${DAILY_QUESTION_LIMIT}-question daily limit. Please try again tomorrow.`,
        ...quotaPayload(DAILY_QUESTION_LIMIT),
      },
      { status: 429 }
    );
  }

  const startIndex = (usage.count - 1) % CHAT_MODELS.length;
  const orderedModels = CHAT_MODELS.map(
    (_, offset) => CHAT_MODELS[(startIndex + offset) % CHAT_MODELS.length]
  );
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const errors = [];

  for (const model of orderedModels) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: "system", content: systemInstruction }, ...messages],
        temperature: 0.6,
        max_completion_tokens: 900,
        reasoning_effort: model.startsWith("openai/") ? "low" : "none",
        include_reasoning: false,
        stream: false,
      });
      const answer = completion.choices?.[0]?.message?.content?.trim();
      if (!answer) throw new Error("The model returned an empty response.");

      await AiUsage.updateOne({ _id: usage._id }, { $set: { lastModel: model } }).catch(
        (error) => console.error("Could not record the successful AI model:", error)
      );
      const remaining = Math.max(0, DAILY_QUESTION_LIMIT - usage.count);

      return new Response(answer, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-AI-Limit": String(DAILY_QUESTION_LIMIT),
          "X-AI-Remaining": String(remaining),
          "X-AI-Model": model,
        },
      });
    } catch (error) {
      errors.push({ model, status: error?.status || null, message: error?.message });
      console.error(`Groq model ${model} failed:`, error?.message || error);
    }
  }

  let quotaReleased = true;
  try {
    await releaseQuestion(usage._id);
  } catch (error) {
    quotaReleased = false;
    console.error("Could not roll back the failed AI quota reservation:", error);
  }
  console.error("All configured Groq models failed:", errors);
  return NextResponse.json(
    {
      message: quotaReleased
        ? "All AI models are temporarily unavailable. Your daily quota was not charged."
        : "All AI models are temporarily unavailable. Please try again later.",
    },
    { status: 503 }
  );
}
