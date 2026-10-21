import test from "node:test";
import assert from "node:assert/strict";
import { AI_SCOPE_REFUSAL, localAiScopeDecision } from "./aiScope.mjs";

const question = (content) => [{ role: "user", content }];

test("allows medicine and health questions", () => {
  assert.equal(localAiScopeDecision(question("What are the side effects of metformin?")), "allowed");
  assert.equal(localAiScopeDecision(question("Mujhe bukhar aur sar dard hai")), "allowed");
  assert.equal(localAiScopeDecision(question("یہ دوا کھانے کے بعد لینی ہے؟")), "allowed");
});

test("allows DawaConnect platform help and greetings", () => {
  assert.equal(localAiScopeDecision(question("How do I track my order?")), "allowed");
  assert.equal(localAiScopeDecision(question("Hello")), "allowed");
});

test("rejects clear entertainment and agriculture prompts", () => {
  assert.equal(localAiScopeDecision(question("Recommend some movies to watch")), "off_topic");
  assert.equal(
    localAiScopeDecision(question("wheat wali fasal ki land preparation kese ki jai")),
    "off_topic",
  );
  assert.equal(localAiScopeDecision(question("Gandum ki fasal ke liye fertilizer batao")), "off_topic");
});

test("sends mixed or contextual requests to semantic classification", () => {
  assert.equal(localAiScopeDecision(question("Recommend a movie about depression")), "needs_model");
  assert.equal(
    localAiScopeDecision([
      { role: "user", content: "Can I take cetirizine?" },
      { role: "assistant", content: "It can cause drowsiness." },
      { role: "user", content: "What about children?" },
    ]),
    "needs_model",
  );
});

test("exports one stable refusal message", () => {
  assert.match(AI_SCOPE_REFUSAL, /only help with medicines/i);
});

