import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const membersHtml = readFileSync(new URL("../members.html", import.meta.url), "utf8");
const siteSource = readFileSync(new URL("../src/site.js", import.meta.url), "utf8");
const firestoreRules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const functionsSource = readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");

test("class signup roster tab follows the administrator roster tab", () => {
  const administratorTab = membersHtml.indexOf('id="admin-tab-administrators"');
  const classSignupTab = membersHtml.indexOf('id="admin-tab-class-signups"');
  const calendarTab = membersHtml.indexOf('id="admin-tab-calendar"');
  assert.ok(administratorTab >= 0);
  assert.ok(classSignupTab > administratorTab);
  assert.ok(calendarTab > classSignupTab);
});

test("class signup roster has its own panel and renderer", () => {
  assert.match(membersHtml, /id="admin-class-signup-management"[^>]*data-admin-panel/);
  assert.match(membersHtml, /data-class-signup-management/);
  assert.match(siteSource, /renderAdminClassSignupOverview\(membersDashboardCache\.classSessions, membersDashboardCache\.classSessionSignups\)/);
  assert.match(siteSource, /報名時間：/);
  assert.doesNotMatch(siteSource, /時段志願：/);
  assert.doesNotMatch(siteSource, /data-admin-class-signup-session-select/);
  assert.match(siteSource, /data-admin-class-signup-filter="academicYear"/);
  assert.match(siteSource, /data-admin-class-signup-filter="term"/);
  assert.match(siteSource, /data-admin-class-signup-filter="timing"/);
  assert.match(siteSource, /entry\.timing === adminClassSignupFilters\.timing/);
  assert.match(siteSource, /getAcademicPeriodForDate\(sessionDate\)/);
  assert.match(siteSource, /admin-class-signup-roster-details/);
  assert.doesNotMatch(siteSource, /data-class-signup-finalize/);
  assert.doesNotMatch(siteSource, /finalizeClassSignupAllocation/);
  assert.doesNotMatch(siteSource, /class_signup_allocation/);
  assert.match(firestoreRules, /match \/memberNotifications\/\{notificationId\}[\s\S]*allow create: if isAdmin\(\)/);
  assert.doesNotMatch(functionsSource, /finalizeClassSessionWhenFull/);
  assert.match(siteSource, /count >= signupLimit/);
  assert.match(firestoreRules, /countBefore < limit/);
  assert.match(siteSource, /Math\.abs\(a\.startMs - currentTimeMs\) - Math\.abs\(b\.startMs - currentTimeMs\)/);
  assert.match(siteSource, /getTimestampMs\(b\.submittedAt \|\| b\.createdAt\) - getTimestampMs\(a\.submittedAt \|\| a\.createdAt\)/);
});

test("semester defaults include an editable class capacity", () => {
  assert.match(membersHtml, /data-class-default-signup-limit/);
  assert.match(membersHtml, /每場預設人數上限/);
  assert.match(siteSource, /classSignupDefaultLimit = Math\.max/);
  assert.match(siteSource, /classSignupDefaultLimit: nextDefaultLimit/);
  assert.match(siteSource, /signupLimit: defaultLimit/);
});
