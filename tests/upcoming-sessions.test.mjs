import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/site.js", import.meta.url), "utf8");
const selector = source.slice(
  source.indexOf("function getUpcomingSignupSessions("),
  source.indexOf("function renderUpcomingClassSessions("),
);
const context = vm.createContext({
  getClassSessionStartMs: (session) => Date.parse(`${session.date}T${session.startTime}Z`),
  getDateTimeLocalMs: (value) => value ? Date.parse(value) : null,
});
vm.runInContext(selector, context);
const now = Date.parse("2026-09-04T08:00:00Z");
const session = (id, date, extras = {}) => ({
  id, date, startTime: "18:00:00", signupRequired: true, ...extras,
});
const ids = (sessions) => Array.from(context.getUpcomingSignupSessions(sessions, now), (entry) => entry.id);

test("shows the next three in session order, including registration not yet open", () => {
  const entries = [
    session("fourth", "2026-09-25"),
    session("second", "2026-09-11", { memberSignupOpenAt: "2026-09-10T08:00:00Z" }),
    session("third", "2026-09-18"),
    session("first", "2026-09-04"),
  ];
  assert.deepEqual(ids(entries), ["first", "second", "third"]);
  assert.equal(entries[0].id, "fourth", "must not reorder the cached source array");
});

test("excludes past, closed, non-signup and invalid-date entries", () => {
  assert.deepEqual(ids([
    session("past", "2026-09-03"),
    session("closed", "2026-09-05", { signupCloseAt: "2026-09-04T07:00:00Z" }),
    session("no-signup", "2026-09-06", { signupRequired: false }),
    session("invalid", "invalid"),
    session("eligible", "2026-09-07"),
  ]), ["eligible"]);
});

test("orders multiple sessions on the same date by start time", () => {
  assert.deepEqual(ids([
    session("late", "2026-09-05", { startTime: "20:00:00" }),
    session("early", "2026-09-05", { startTime: "10:00:00" }),
  ]), ["early", "late"]);
});

test("handles empty data and fewer than three sessions", () => {
  assert.deepEqual(ids([]), []);
  assert.deepEqual(ids([session("only", "2026-09-05")]), ["only"]);
});
