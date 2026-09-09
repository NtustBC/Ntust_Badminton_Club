import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const membersHtml = readFileSync(new URL("../members.html", import.meta.url), "utf8");
const siteSource = readFileSync(new URL("../src/site.js", import.meta.url), "utf8");

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
  assert.match(siteSource, /時段志願：/);
  assert.match(siteSource, /data-admin-class-signup-session-select/);
  assert.match(siteSource, /data-admin-class-signup-filter="academicYear"/);
  assert.match(siteSource, /data-admin-class-signup-filter="term"/);
  assert.match(siteSource, /data-admin-class-signup-filter="timing"/);
  assert.match(siteSource, /entry\.timing === adminClassSignupFilters\.timing/);
  assert.match(siteSource, /getAcademicPeriodForDate\(sessionDate\)/);
  assert.match(siteSource, /admin-class-signup-roster-details/);
  assert.match(siteSource, /getClassSessionSortMs\(b\.session\) - getClassSessionSortMs\(a\.session\)/);
});
