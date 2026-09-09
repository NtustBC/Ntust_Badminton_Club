import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const siteSource = readFileSync(new URL("../src/site.js", import.meta.url), "utf8");
const functionsSource = readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");

test("class signup is written through the authoritative callable", () => {
  const start = siteSource.indexOf("async function upsertClassSessionSignup(");
  const end = siteSource.indexOf("async function deleteClassSessionSignup(", start);
  const implementation = siteSource.slice(start, end);

  assert.match(implementation, /httpsCallable\(functionsClient, "upsertClassSessionSignup"\)/);
  assert.doesNotMatch(implementation, /runTransaction\(/);
  assert.doesNotMatch(siteSource, /upsertClassSessionSignupDirect/);
});

test("class signup cancellation uses the callable and has no missing document helper", () => {
  const start = siteSource.indexOf("async function deleteClassSessionSignup(");
  const end = siteSource.indexOf("async function adminDeleteClassSessionSignup(", start);
  const implementation = siteSource.slice(start, end);

  assert.match(implementation, /httpsCallable\(functionsClient, "deleteClassSessionSignup"\)/);
  assert.doesNotMatch(siteSource, /getClassSignupDocRef/);
});

test("missing token email does not create an invalid approval document reference", () => {
  assert.match(functionsSource, /const approvalSnapshotPromise = authEmail\s*\?[^:]+\.doc\(authEmail\)\.get\(\)\s*:\s*Promise\.resolve\(null\)/s);
  assert.match(functionsSource, /Boolean\(approvalSnapshot\?\.exists\)/);
});

test("capacity is calculated from signups inside the same transaction", () => {
  const start = functionsSource.indexOf("exports.upsertClassSessionSignup =");
  const end = functionsSource.indexOf("exports.deleteClassSessionSignup =", start);
  const implementation = functionsSource.slice(start, end);

  assert.match(implementation, /transaction\.get\(signupsQuery\)/);
  assert.match(implementation, /sessionSignups\.docs\.filter/);
  assert.match(implementation, /new HttpsError\("internal",[^;]+\{ stage \}\)/s);
});

test("generic callable failures are replaced with a useful user message", () => {
  assert.match(siteSource, /rawMessage\.toLowerCase\(\) !== "internal"/);
  assert.match(siteSource, /報名服務暫時發生錯誤，請稍後再試；若持續發生請聯絡幹部。/);
  assert.doesNotMatch(siteSource, /`（\$\{errorCode\}）`/);
});
