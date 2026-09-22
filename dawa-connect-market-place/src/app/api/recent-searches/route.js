import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/mongodb";
import RecentSearch from "@/models/RecentSearch";

const JWT_SECRET = process.env.JWT_SECRET;
const key = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;
const MAX_RECENT_SEARCHES = 8;

async function getUserIdFromReq(req) {
  if (!key) return null;
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload.userId || null;
  } catch {
    return null;
  }
}

function getSessionId(req) {
  return req.headers.get("x-session-id") || null;
}

function getOwnerFilter(userId, sessionId) {
  if (userId) return { userId };
  if (sessionId) return { sessionId };
  return null;
}

export async function GET(req) {
  try {
    await connectToDatabase();
    const userId = await getUserIdFromReq(req);
    const sessionId = getSessionId(req);
    const ownerFilter = getOwnerFilter(userId, sessionId);
    if (!ownerFilter) return NextResponse.json({ recentSearches: [] }, { status: 200 });

    const { searchParams } = new URL(req.url);
    const sortMode = searchParams.get("sort") === "frequency" ? "frequency" : "recent";
    const requestedLimit = parseInt(searchParams.get("limit"), 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : MAX_RECENT_SEARCHES;

    let sortOpts;
    if (sortMode === "frequency") sortOpts = { searchCount: -1, updatedAt: -1 };
    else sortOpts = { updatedAt: -1 };

    const recentSearches = await RecentSearch.find(ownerFilter).sort(sortOpts).limit(limit);

    return NextResponse.json({ recentSearches }, { status: 200 });
  } catch (error) {
    console.error("Get recent searches error:", error);
    return NextResponse.json({ message: "Failed to get recent searches" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectToDatabase();
    const userId = await getUserIdFromReq(req);
    const sessionId = getSessionId(req);
    const ownerFilter = getOwnerFilter(userId, sessionId);
    if (!ownerFilter) return NextResponse.json({ message: "Missing session" }, { status: 400 });

    const { query } = await req.json();
    const normalizedQuery = String(query || "").trim();
    if (!normalizedQuery) return NextResponse.json({ message: "Query is required" }, { status: 400 });

    const filter = { ...ownerFilter, query: normalizedQuery };
    await RecentSearch.findOneAndUpdate(
      filter,
      {
        $setOnInsert: { ...ownerFilter, query: normalizedQuery },
        $inc: { searchCount: 1 },
      },
      { upsert: true, new: true, timestamps: true, setDefaultsOnInsert: true }
    );

    const all = await RecentSearch.find(ownerFilter).sort({ updatedAt: -1 });
    if (all.length > MAX_RECENT_SEARCHES) {
      const idsToDelete = all.slice(MAX_RECENT_SEARCHES).map((item) => item._id);
      await RecentSearch.deleteMany({ _id: { $in: idsToDelete } });
    }

    const recentSearches = await RecentSearch.find(ownerFilter).sort({ updatedAt: -1 }).limit(MAX_RECENT_SEARCHES);
    return NextResponse.json({ recentSearches }, { status: 200 });
  } catch (error) {
    console.error("Create recent search error:", error);
    return NextResponse.json({ message: "Failed to store recent search" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await connectToDatabase();
    const userId = await getUserIdFromReq(req);
    const sessionId = getSessionId(req);
    const ownerFilter = getOwnerFilter(userId, sessionId);
    if (!ownerFilter) return NextResponse.json({ message: "Missing session" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ message: "Search id is required" }, { status: 400 });

    await RecentSearch.deleteOne({ _id: id, ...ownerFilter });
    const recentSearches = await RecentSearch.find(ownerFilter).sort({ updatedAt: -1 }).limit(MAX_RECENT_SEARCHES);
    return NextResponse.json({ recentSearches }, { status: 200 });
  } catch (error) {
    console.error("Delete recent search error:", error);
    return NextResponse.json({ message: "Failed to delete recent search" }, { status: 500 });
  }
}
