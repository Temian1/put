import { describe, it, expect } from "vitest";
import { normalizePhone, detectNetwork } from "../src/game/airtime.js";

describe("airtime numbers", () => {
  it("turns the ways people write a Nigerian number into one form", () => {
    expect(normalizePhone("0803 123 4567")).toBe("08031234567");
    expect(normalizePhone("+234 803 123 4567")).toBe("08031234567");
    expect(normalizePhone("2348031234567")).toBe("08031234567");
    expect(normalizePhone("8031234567")).toBe("08031234567");
    expect(normalizePhone("(0905)-123-4567")).toBe("09051234567");
  });

  it("refuses numbers that are not Nigerian mobiles", () => {
    expect(normalizePhone("0803123456")).toBe(null);
    expect(normalizePhone("080312345678")).toBe(null);
    expect(normalizePhone("01234567890")).toBe(null);
    expect(normalizePhone("")).toBe(null);
    expect(normalizePhone("call me")).toBe(null);
  });

  it("names the network from the prefix, even while typing", () => {
    expect(detectNetwork("08031234567")).toBe("mtn");
    expect(detectNetwork("0803")).toBe("mtn");
    expect(detectNetwork("+234 912")).toBe("airtel");
    expect(detectNetwork("0805")).toBe("glo");
    expect(detectNetwork("0809 999")).toBe("9mobile");
    expect(detectNetwork("07025123456")).toBe("mtn");
    expect(detectNetwork("080")).toBe(null);
    expect(detectNetwork("0702 123")).toBe(null);
  });
});
