import { describe, expect, it } from "vitest";

import { bucketOf, chargedOf, daysOverdue, outstandingOf, paidTotal } from "@/lib/club/accounting";
import type { ClubPlayer } from "@/lib/club/seed";

function player(patch: Partial<ClubPlayer>): ClubPlayer {
  return {
    id: "p1",
    name: "A Player",
    firstName: "A",
    surname: "Player",
    regNumber: "REG-0001",
    idNumber: "",
    mobile: "",
    correspondence: [],
    squadNumber: 1,
    position: "Central midfielder",
    teamId: "team",
    homework: "",
    seasonFee: 1000,
    sponsoredAmount: 0,
    feeDueDate: "2026-10-01",
    payments: [],
    paymentPlan: null,
    promise: null,
    guardianName: "",
    guardianEmail: "",
    accessPin: "",
    ...patch,
  };
}

describe("fees", () => {
  it("subtracts sponsorship and payments from the amount owed", () => {
    const row = player({
      seasonFee: 1000,
      sponsoredAmount: 200,
      payments: [{ id: "pay-1", date: "2026-10-02", amount: 300 }],
    });
    expect(paidTotal(row)).toBe(300);
    expect(chargedOf(row)).toBe(800);
    expect(outstandingOf(row)).toBe(500);
  });

  it("ages overdue balances into the printed buckets", () => {
    const row = player({ feeDueDate: "2026-09-01" });
    expect(daysOverdue(row, "2026-10-28")).toBe(57);
    expect(bucketOf(0)).toBe("Current");
    expect(bucketOf(30)).toBe("1–30 days");
    expect(bucketOf(31)).toBe("31–60 days");
    expect(bucketOf(91)).toBe("90+ days");
    expect(daysOverdue(player({ payments: [{ id: "pay-1", date: "2026-10-02", amount: 1000 }] }), "2026-10-28")).toBe(0);
  });
});
