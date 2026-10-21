export const AI_SCOPE_REFUSAL =
  "I can only help with medicines, pharmacies, general health information, and using DawaConnect. Please ask a health or pharmacy-related question.";

const HEALTH_TERMS = [
  "medicine", "medicines", "medication", "medications", "drug", "drugs", "tablet", "tablets",
  "capsule", "capsules", "syrup", "injection", "dose", "dosage", "side effect", "side effects",
  "interaction", "interactions", "prescription", "pharmacy", "pharmacies", "pharmacist", "doctor",
  "hospital", "clinic", "health", "medical", "symptom", "symptoms", "disease", "treatment",
  "allergy", "allergies", "infection", "antibiotic", "vaccine", "vaccination", "fever", "pain",
  "headache", "migraine", "cough", "flu", "cold", "nausea", "vomiting", "diarrhea", "wound",
  "blood pressure", "diabetes", "pregnancy", "anxiety", "depression", "mental health", "emergency",
  "chest pain", "breathing", "nutrition", "diet", "exercise", "sleep", "dawai", "dawa", "daway",
  "ilaaj", "ilaj", "sehat", "bimari", "bemari", "bukhar", "khansi", "dard", "ulti", "dast",
  "sar dard", "دوا", "دوائی", "ادویات", "صحت", "بیماری", "علاج", "بخار", "کھانسی", "درد",
];

const PLATFORM_TERMS = [
  "dawaconnect", "dawa connect", "medicine marketplace", "user portal", "pharmacy portal",
  "my cart", "checkout", "track my order", "order tracking", "delivery address", "find care",
  "nearby pharmacy", "nearby pharmacies", "sign in", "signin", "log in", "login", "sign up", "signup",
];

const OFF_TOPIC_TERMS = [
  "movie", "movies", "film", "films", "actor", "actress", "song", "songs", "lyrics", "cricket",
  "football", "match score", "sports score", "politics", "election", "president", "prime minister",
  "stock market", "cryptocurrency", "crypto", "bitcoin", "coding", "programming", "javascript", "python",
  "video game", "gaming", "restaurant", "hotel", "travel itinerary", "recipe", "cooking", "poem",
  "write an essay", "short story", "agriculture", "agricultural", "farming", "crop", "crops", "wheat",
  "rice crop", "land preparation", "irrigation", "fertilizer", "fertiliser", "fasal", "gandum", "kheti",
  "zameen ki tayari", "زمین کی تیاری", "فصل", "گندم", "کھیتی", "weather forecast",
];

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsTerm(text, term) {
  const normalizedTerm = normalize(term);
  return Boolean(normalizedTerm) && ` ${text} `.includes(` ${normalizedTerm} `);
}

function containsAny(text, terms) {
  return terms.some((term) => containsTerm(text, term));
}

function isSimpleGreeting(text) {
  return /^(hi|hello|hey|salam|assalam o alaikum|assalamualaikum|aoa|good morning|good afternoon|good evening)( there)?$/.test(text);
}

/**
 * Returns only high-confidence local decisions. Ambiguous requests are sent to
 * the semantic scope classifier in the API route so that mixed-language and
 * contextual follow-ups do not depend on a brittle keyword list.
 */
export function localAiScopeDecision(messages) {
  const latest = [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find((message) => message?.role === "user" && typeof message.content === "string");
  const text = normalize(latest?.content);
  if (!text) return "needs_model";
  if (isSimpleGreeting(text)) return "allowed";

  const hasAllowedSubject = containsAny(text, HEALTH_TERMS) || containsAny(text, PLATFORM_TERMS);
  const hasOffTopicSubject = containsAny(text, OFF_TOPIC_TERMS);

  if (hasOffTopicSubject && !hasAllowedSubject) return "off_topic";
  if (hasAllowedSubject && !hasOffTopicSubject) return "allowed";
  return "needs_model";
}

