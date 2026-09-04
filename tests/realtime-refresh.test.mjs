import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const siteSource = readFileSync(new URL("../src/site.js", import.meta.url), "utf8");
const firebaseSource = readFileSync(new URL("../src/firebase-modules.js", import.meta.url), "utf8");

test("site refresh uses realtime listeners instead of fixed polling", () => {
  assert.doesNotMatch(siteSource, /setInterval\s*\(/);
  assert.match(siteSource, /subscribeAfterInitialSnapshot/);
  assert.match(firebaseSource, /\bonSnapshot\b/);
});

test("a realtime subscription ignores its initial snapshot and reacts to later changes", () => {
  let emitSnapshot;
  let emitError;
  let unsubscribed = false;
  const context = vm.createContext({
    onSnapshot: (_reference, onNext, onError) => {
      emitSnapshot = onNext;
      emitError = onError;
      return () => { unsubscribed = true; };
    },
    console: { warn: () => {} },
  });
  const start = siteSource.indexOf("const subscribeAfterInitialSnapshot =");
  const end = siteSource.indexOf("const canApplyRealtimePageRefresh =", start);
  vm.runInContext(`${siteSource.slice(start, end)}\nthis.subscribe = subscribeAfterInitialSnapshot;`, context);

  let changes = 0;
  const unsubscribe = context.subscribe({}, () => { changes += 1; }, "test");
  emitSnapshot({ version: 1 });
  assert.equal(changes, 0);
  emitSnapshot({ version: 2 });
  assert.equal(changes, 1);
  assert.doesNotThrow(() => emitError(new Error("offline")));
  unsubscribe();
  assert.equal(unsubscribed, true);
});

test("background tabs defer page work until visibility resumes", () => {
  const schedulerStart = siteSource.indexOf("const scheduleRealtimePageRefresh =");
  const schedulerEnd = siteSource.indexOf("const configurePageRealtimeSubscriptions =", schedulerStart);
  assert.match(siteSource.slice(schedulerStart, schedulerEnd), /document\.hidden/);
  assert.match(siteSource, /visibilitychange/);
});
