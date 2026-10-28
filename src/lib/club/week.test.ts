import { describe, expect, it } from "vitest";

import { addDays, formatDate, formatDay, mondayOf, parseDisplayDate, weekDates } from "@/lib/club/week";

describe("dates", () => {
  it("prints calendar dates as dd/mm/yyyy", () => {
    expect(formatDate("2026-10-28")).toBe("28/10/2026");
    expect(formatDate("2026-01-05")).toBe("05/01/2026");
    expect(formatDay("2026-10-28")).toBe("Wed 28/10/2026");
  });

  it("leaves text that is not a calendar date unchanged", () => {
    expect(formatDate("28 Oct")).toBe("28 Oct");
    expect(formatDate("2026-02-31")).toBe("2026-02-31");
  });

  it("parses day/month/year and rejects impossible dates", () => {
    expect(parseDisplayDate("28/10/2026")).toBe("2026-10-28");
    expect(parseDisplayDate("5-1-2026")).toBe("2026-01-05");
    expect(parseDisplayDate("31/02/2026")).toBeNull();
    expect(parseDisplayDate("10/13/2026")).toBeNull();
    expect(parseDisplayDate("2026-10-28")).toBeNull();
  });

  it("walks weeks from Monday", () => {
    expect(mondayOf("2026-10-28")).toBe("2026-10-26");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(weekDates("2026-10-26")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });
});
