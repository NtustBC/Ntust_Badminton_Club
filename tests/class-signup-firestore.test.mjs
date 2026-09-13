import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/site.js", import.meta.url), "utf8");
const implementation = source.slice(source.indexOf("async function upsertClassSessionSignup("), source.indexOf("async function adminDeleteClassSessionSignup("));
const allocationImplementation = source.slice(source.indexOf("function allocateClassSignupPreferences("), source.indexOf("function maskPublicName("));
const stamp = (ms) => ({ toMillis: () => ms });

function fixture({ member = { membershipStatus: "formal_member", name: "Test", studentId: "TEST001" }, session = {}, stats, signup, admin = false, approval = false } = {}) {
  const now = Date.now();
  const documents = new Map([
    ["classSessions/s", { signupRequired: true, signupLimit: 1, allowNonMembers: true,
      memberSignupOpenAtTimestamp: stamp(now - 10000), publicSignupOpenAtTimestamp: stamp(now - 5000),
      signupCloseAtTimestamp: stamp(now + 100000), ...session }],
    ["members/u", member],
  ]);
  if (stats) documents.set("classSessionStats/s", stats);
  if (signup) documents.set("classSessionSignups/s-u", signup);
  if (admin) documents.set("admins/u", {});
  if (approval) documents.set("signupApprovals/test@example.com", {});
  let revision = 0;
  const context = vm.createContext({
    db: {}, currentUser: { uid: "u", email: "test@example.com" },
    CLASS_SIGNUP_COLLECTION: "classSessionSignups", CLASS_SESSION_STATS_COLLECTION: "classSessionStats", CLASS_SESSION_COLLECTION: "classSessions",
    CLASS_SIGNUP_SLOT_KEYS: ["firstHalf", "secondHalf"],
    normalizeClassSignupSlots: (value, { fallbackToBoth = false } = {}) => {
      const slots = Array.isArray(value) ? value.filter((slot, index) => ["firstHalf", "secondHalf"].includes(slot) && value.indexOf(slot) === index) : [];
      return slots.length || !fallbackToBoth ? slots : ["firstHalf", "secondHalf"];
    },
    getClassSignupSlots: (signup = {}) => {
      const slots = Array.isArray(signup.timeSlots) ? signup.timeSlots.filter((slot, index) => ["firstHalf", "secondHalf"].includes(slot) && signup.timeSlots.indexOf(slot) === index) : [];
      return slots.length || !(signup.id || signup.userId || signup.sessionId) ? slots : ["firstHalf", "secondHalf"];
    },
    getClassSignupPreferences: (signup = {}) => {
      const value = Array.isArray(signup.slotPreferences) ? signup.slotPreferences : signup.timeSlots;
      const slots = Array.isArray(value) ? value.filter((slot, index) => ["firstHalf", "secondHalf"].includes(slot) && value.indexOf(slot) === index) : [];
      return slots.length || !(signup.id || signup.userId || signup.sessionId) ? slots : ["firstHalf", "secondHalf"];
    },
    ensureAuthReady: async () => {}, doc: (_, collection, id) => `${collection}/${id}`,
    getMemberDocRef: (uid) => `members/${uid}`, getClassSessionId: (s) => s.id,
    getSessionSignupLimit: (s) => s.signupLimit > 0 ? Math.floor(s.signupLimit) : null,
    serverTimestamp: () => "SERVER_TIME", navigator: { onLine: true },
    runTransaction: async (_, callback) => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const startRevision = revision;
        const snapshot = new Map(documents);
        const writes = [];
        const result = await callback({
          get: async (ref) => {
            assert.equal(writes.length, 0, "all reads must precede writes");
            return { exists: () => snapshot.has(ref), data: () => snapshot.get(ref) };
          },
          set: (ref, data) => writes.push([ref, data]),
          update: (ref, data) => writes.push([ref, { ...snapshot.get(ref), ...data }]),
          delete: (ref) => writes.push([ref, undefined]),
        });
        if (revision !== startRevision) continue;
        for (const [ref, value] of writes) value === undefined ? documents.delete(ref) : documents.set(ref, value);
        if (writes.length) revision++;
        return result;
      }
      throw new Error("transaction retries exhausted");
    },
  });
  vm.runInContext(implementation, context);
  return { documents, context, signup: (note = "", timeSlots = ["firstHalf", "secondHalf"]) => context.upsertClassSessionSignup({ id: "s" }, { note, timeSlots }), cancel: () => context.deleteClassSessionSignup("s") };
}

test("member signup atomically records preferences for later allocation", async () => {
  const f = fixture();
  assert.equal((await f.signup("hello")).signupStatus, "pending");
  const signup = f.documents.get("classSessionSignups/s-u");
  assert.equal(signup.dropInPaymentStatus, "not_required");
  assert.equal(signup.name, "Test");
  assert.equal(signup.note, "hello");
  assert.deepEqual(Array.from(signup.timeSlots), ["firstHalf", "secondHalf"]);
  assert.deepEqual(Array.from(signup.slotPreferences), ["firstHalf", "secondHalf"]);
  assert.equal(signup.createdAt, "SERVER_TIME");
  assert.equal("signupStatus" in signup, false, "existing rules do not allow this field on create");
  assert.equal(f.documents.get("classSessionStats/s").signupCount, 1);
  assert.equal(f.documents.get("classSessionStats/s").firstHalfCount, 1);
  assert.equal(f.documents.get("classSessionStats/s").secondHalfCount, 1);
});

test("preferences remain open even when current demand reaches the slot limit", async () => {
  const f = fixture({ stats: { sessionId: "s", signupCount: 1, firstHalfCount: 1, secondHalfCount: 0 } });
  await f.signup("", ["firstHalf"]);
  assert.equal(f.documents.get("classSessionStats/s").signupCount, 2);
  assert.equal(f.documents.get("classSessionStats/s").firstHalfCount, 2);
  assert.equal(f.documents.get("classSessionStats/s").secondHalfCount, 0);
});

test("an existing signup can change its selected halves atomically", async () => {
  const f = fixture();
  await f.signup("", ["firstHalf"]);
  await f.signup("updated", ["firstHalf", "secondHalf"]);
  const stats = f.documents.get("classSessionStats/s");
  assert.equal(stats.signupCount, 1);
  assert.equal(stats.firstHalfCount, 1);
  assert.equal(stats.secondHalfCount, 1);
  assert.equal(f.documents.get("classSessionSignups/s-u").note, "updated");
});

test("the selected half order is preserved as the signup priority", async () => {
  const f = fixture();
  const result = await f.signup("", ["secondHalf", "firstHalf"]);
  assert.deepEqual(Array.from(result.timeSlots), ["secondHalf", "firstHalf"]);
  assert.deepEqual(Array.from(f.documents.get("classSessionSignups/s-u").slotPreferences), ["secondHalf", "firstHalf"]);
});

test("a full-looking first choice is still recorded before batch allocation", async () => {
  const f = fixture({ stats: { sessionId: "s", signupCount: 1, firstHalfCount: 1, secondHalfCount: 0 } });
  const result = await f.signup("", ["firstHalf", "secondHalf"]);
  assert.deepEqual(Array.from(result.slotPreferences), ["firstHalf", "secondHalf"]);
  assert.deepEqual(Array.from(result.timeSlots), ["firstHalf", "secondHalf"]);
  assert.equal(f.documents.get("classSessionStats/s").firstHalfCount, 2);
  assert.equal(f.documents.get("classSessionStats/s").secondHalfCount, 1);
});

test("a signup must select at least one half", async () => {
  const f = fixture();
  await assert.rejects(f.signup("", []), /至少選擇一個/);
  assert.equal(f.documents.has("classSessionSignups/s-u"), false);
});

test("concurrent duplicate submissions retry without counting the same member twice", async () => {
  const f = fixture();
  await Promise.all([f.signup("first"), f.signup("second")]);
  assert.equal(f.documents.get("classSessionStats/s").signupCount, 1);
  assert.equal(f.documents.get("classSessionSignups/s-u").note, "second");
});

test("concurrent users can both record preferences before final allocation", async () => {
  const f = fixture();
  f.documents.set("members/v", { membershipStatus: "formal_member" });
  const otherClient = vm.createContext({ ...f.context, currentUser: { uid: "v", email: "other@example.com" } });
  vm.runInContext(implementation, otherClient);
  const results = await Promise.allSettled([f.signup(), otherClient.upsertClassSessionSignup({ id: "s" })]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  assert.equal(f.documents.get("classSessionStats/s").signupCount, 2);
});

test("non-member gets the public window and unpaid drop-in status", async () => {
  const f = fixture({ member: { membershipStatus: "not_applied" } });
  await f.signup();
  assert.equal(f.documents.get("classSessionSignups/s-u").dropInPaymentStatus, "unpaid");
  const early = fixture({ member: {}, session: { publicSignupOpenAtTimestamp: stamp(Date.now() + 100000) } });
  await assert.rejects(early.signup(), /尚未開放非社員/);
  assert.equal(early.documents.has("classSessionStats/s"), false);
});

test("approval and administrator records grant formal access", async () => {
  for (const access of [{ approval: true }, { admin: true }]) {
    const f = fixture({ member: {}, session: { allowNonMembers: false }, ...access });
    await f.signup();
    assert.equal(f.documents.get("classSessionSignups/s-u").isFormalMemberAtSignup, true);
  }
});

test("rejects member-only, closed and incomplete sessions without any write", async () => {
  for (const [options, message] of [
    [{ member: {}, session: { allowNonMembers: false } }, /僅限正式社員/],
    [{ session: { signupCloseAtTimestamp: stamp(Date.now() - 1000) } }, /已截止/],
    [{ session: { memberSignupOpenAtTimestamp: null } }, /設定不完整/],
  ]) {
    const f = fixture(options);
    await assert.rejects(f.signup(), message);
    assert.equal(f.documents.has("classSessionSignups/s-u"), false);
  }
});

test("rejects new preference changes after automatic allocation is published", async () => {
  const f = fixture({ session: { allocationState: "published", allocationPublishedAt: stamp(Date.now()) } });
  await assert.rejects(f.signup(), /完成結算/);
  assert.equal(f.documents.has("classSessionSignups/s-u"), false);
});

test("batch allocation completes every first choice before considering second choices", () => {
  const context = vm.createContext({
    DEFAULT_CLASS_SLOT_LIMIT: 30,
    getTimestampMs: (value) => Number(value || 0),
    getClassSignupPreferences: (signup) => signup.slotPreferences,
  });
  vm.runInContext(allocationImplementation, context);
  const result = context.allocateClassSignupPreferences([
    { id: "early", createdAt: 1, slotPreferences: ["firstHalf", "secondHalf"] },
    { id: "later", createdAt: 2, slotPreferences: ["secondHalf"] },
  ], 1);
  assert.deepEqual(Array.from(result[0].timeSlots), ["firstHalf"]);
  assert.deepEqual(Array.from(result[1].timeSlots), ["secondHalf"]);
});

test("batch allocation admits both choices when both slots have room", () => {
  const context = vm.createContext({
    DEFAULT_CLASS_SLOT_LIMIT: 30,
    getTimestampMs: (value) => Number(value || 0),
    getClassSignupPreferences: (signup) => signup.slotPreferences,
  });
  vm.runInContext(allocationImplementation, context);
  const result = context.allocateClassSignupPreferences([
    { id: "a", createdAt: 1, slotPreferences: ["firstHalf", "secondHalf"] },
    { id: "b", createdAt: 2, slotPreferences: ["secondHalf", "firstHalf"] },
  ], 2);
  assert.deepEqual(Array.from(result, (entry) => Array.from(entry.timeSlots)), [
    ["firstHalf", "secondHalf"],
    ["secondHalf", "firstHalf"],
  ]);
});

test("updating an existing signup only changes the note even after closing", async () => {
  const f = fixture({ signup: { userId: "u", createdAt: "original", note: "before" }, stats: { sessionId: "s", signupCount: 1 }, session: { signupCloseAtTimestamp: stamp(1) } });
  await f.signup("x".repeat(600));
  assert.equal(f.documents.get("classSessionSignups/s-u").note.length, 500);
  assert.equal(f.documents.get("classSessionSignups/s-u").createdAt, "original");
  assert.equal(f.documents.get("classSessionStats/s").signupCount, 1);
});

test("cancellation releases capacity once and a subsequent signup can take it", async () => {
  const f = fixture();
  await f.signup();
  await Promise.all([f.cancel(), f.cancel()]);
  assert.equal(f.documents.get("classSessionStats/s").signupCount, 0);
  assert.equal(f.documents.has("classSessionSignups/s-u"), false);
  await f.signup();
  assert.equal(f.documents.get("classSessionStats/s").signupCount, 1);
});

test("invalid counter and legacy waitlist cancellation fail without deleting the signup", async () => {
  for (const options of [
    { signup: { userId: "u" }, stats: { signupCount: 0 } },
    { signup: { userId: "u", signupStatus: "waitlisted" }, stats: { signupCount: 1 } },
  ]) {
    const f = fixture(options);
    await assert.rejects(f.cancel());
    assert.equal(f.documents.has("classSessionSignups/s-u"), true);
  }
});

test("signup and cancellation do not depend on Cloud Functions", () => {
  assert.doesNotMatch(implementation, /httpsCallable|functionsClient/);
  const f = fixture();
  assert.match(f.context.getClassSignupErrorMessage({ code: "permission-denied", message: "Missing or insufficient permissions." }), /權限檢查/);
  assert.match(f.context.getClassSignupErrorMessage({ code: "functions/internal", message: "internal" }), /報名服務暫時發生錯誤/);
});
