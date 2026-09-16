import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/site.js", import.meta.url), "utf8");
const implementation = source.slice(source.indexOf("async function upsertClassSessionSignup("), source.indexOf("async function adminDeleteClassSessionSignup("));
const stamp = (ms) => ({ toMillis: () => ms });

function fixture({ member = { membershipStatus: "formal_member", name: "Test", studentId: "TEST001" }, session = {}, stats, signup } = {}) {
  const now = Date.now();
  const documents = new Map([
    ["classSessions/s", { signupRequired: true, signupLimit: 1, allowNonMembers: true,
      memberSignupOpenAtTimestamp: stamp(now - 10000), publicSignupOpenAtTimestamp: stamp(now - 5000),
      signupCloseAtTimestamp: stamp(now + 100000), ...session }],
    ["members/u", member],
  ]);
  if (stats) documents.set("classSessionStats/s", stats);
  if (signup) documents.set("classSessionSignups/s-u", signup);
  let revision = 0;
  const context = vm.createContext({
    db: {}, currentUser: { uid: "u", email: "test@example.com" },
    CLASS_SIGNUP_COLLECTION: "classSessionSignups", CLASS_SESSION_STATS_COLLECTION: "classSessionStats", CLASS_SESSION_COLLECTION: "classSessions",
    CLASS_SIGNUP_SLOT_KEYS: ["firstHalf", "secondHalf"],
    ensureAuthReady: async () => {}, doc: (_, collection, id) => `${collection}/${id}`,
    getMemberDocRef: (uid) => `members/${uid}`, getClassSessionId: (s) => s.id,
    getSessionSignupLimit: (s) => s.signupLimit > 0 ? Math.floor(s.signupLimit) : 30,
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
  return { documents, context, signup: (note = "") => context.upsertClassSessionSignup({ id: "s" }, { note }), cancel: () => context.deleteClassSessionSignup("s") };
}

test("signup is accepted immediately without preferences", async () => {
  const f = fixture();
  assert.equal((await f.signup("hello")).signupStatus, "accepted");
  const signup = f.documents.get("classSessionSignups/s-u");
  assert.equal(signup.note, "hello");
  assert.equal("slotPreferences" in signup, false);
  assert.deepEqual(Array.from(signup.timeSlots), ["firstHalf", "secondHalf"]);
  assert.equal(f.documents.get("classSessionStats/s").signupCount, 1);
});

test("a full session rejects a new signup", async () => {
  const f = fixture({ stats: { sessionId: "s", signupCount: 1, firstHalfCount: 1, secondHalfCount: 1 } });
  await assert.rejects(f.signup(), /名額已滿/);
  assert.equal(f.documents.has("classSessionSignups/s-u"), false);
});

test("raising the session limit allows the next signup", async () => {
  const f = fixture({ session: { signupLimit: 2 }, stats: { sessionId: "s", signupCount: 1, firstHalfCount: 1, secondHalfCount: 1 } });
  await f.signup();
  assert.equal(f.documents.get("classSessionStats/s").signupCount, 2);
});

test("concurrent duplicate submissions count the member once", async () => {
  const f = fixture();
  await Promise.all([f.signup("first"), f.signup("second")]);
  assert.equal(f.documents.get("classSessionStats/s").signupCount, 1);
  assert.equal(f.documents.get("classSessionSignups/s-u").note, "second");
});

test("existing signup can update its note when capacity is full", async () => {
  const f = fixture({ signup: { userId: "u", createdAt: "original", note: "before" }, stats: { sessionId: "s", signupCount: 1 } });
  await f.signup("updated");
  assert.equal(f.documents.get("classSessionSignups/s-u").note, "updated");
  assert.equal(f.documents.get("classSessionStats/s").signupCount, 1);
});

test("non-member uses the public window and pays drop-in fee", async () => {
  const f = fixture({ member: { membershipStatus: "not_applied" } });
  await f.signup();
  assert.equal(f.documents.get("classSessionSignups/s-u").dropInPaymentStatus, "unpaid");
  const early = fixture({ member: {}, session: { publicSignupOpenAtTimestamp: stamp(Date.now() + 100000) } });
  await assert.rejects(early.signup(), /尚未開放非社員/);
});

test("member-only and closed sessions reject signups", async () => {
  for (const [options, message] of [
    [{ member: {}, session: { allowNonMembers: false } }, /僅限正式社員/],
    [{ session: { signupCloseAtTimestamp: stamp(Date.now() - 1000) } }, /已截止/],
  ]) {
    const f = fixture(options);
    await assert.rejects(f.signup(), message);
    assert.equal(f.documents.has("classSessionSignups/s-u"), false);
  }
});

test("cancellation releases capacity exactly once", async () => {
  const f = fixture();
  await f.signup();
  await Promise.all([f.cancel(), f.cancel()]);
  assert.equal(f.documents.get("classSessionStats/s").signupCount, 0);
  assert.equal(f.documents.has("classSessionSignups/s-u"), false);
});

test("signup and cancellation do not depend on Cloud Functions", () => {
  assert.doesNotMatch(implementation, /httpsCallable|functionsClient/);
});
