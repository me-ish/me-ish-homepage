import { describe, expect, it } from "vitest";
import { suggestEmailDomain } from "@/features/natori/lib/emailTypoSuggestion";

describe("suggestEmailDomain", () => {
  it.each([
    ["taro@gmial.com", "taro@gmail.com"],
    ["taro@gmail.co", "taro@gmail.com"],
    ["taro@gmai.com", "taro@gmail.com"],
    ["taro@icloud.co", "taro@icloud.com"],
    ["taro@yahoo.co.jo", "taro@yahoo.co.jp"],
    ["taro@outlok.com", "taro@outlook.com"],
    ["taro@hotmial.com", "taro@hotmail.com"],
    ["taro@docomo.ne.lp", "taro@docomo.ne.jp"],
    ["taro@ezwed.ne.jp", "taro@ezweb.ne.jp"],
    ["taro@softbank.ne.j", "taro@softbank.ne.jp"],
    ["  Taro.Name@GMIAL.COM ", "Taro.Name@gmail.com"],
  ])("%s を %s と提案する", (input, expected) => {
    expect(suggestEmailDomain(input)).toBe(expected);
  });

  it.each([
    "taro@gmail.com",
    "taro@yahoo.co.jp",
    "taro@ymail.com",
    "taro@mail.com",
    "taro@hotmail.co.jp",
    "taro@outlook.jp",
    "taro@me-ish.art",
    "taro@example.com",
    "taro@",
    "@gmail.com",
    "taro",
    "",
  ])("%s には提案しない", (input) => {
    expect(suggestEmailDomain(input)).toBeNull();
  });

  it("3文字以上ずれたドメインは別のドメインとして扱う", () => {
    expect(suggestEmailDomain("taro@gamil.co.jp")).toBeNull();
  });
});
