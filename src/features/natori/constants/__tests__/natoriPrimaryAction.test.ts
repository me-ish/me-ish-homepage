import { describe, expect, it } from "vitest";
import { natoriPrimaryActionColors, natoriSoftActionColors } from "@/features/natori/constants/natoriPrimaryAction";
import { portfolioColors, legacyNatoriTransactionColors } from "@/features/natori/constants/portfolioContent";
import { portfolioFormColors } from "@/features/natori/components/portfolio/PortfolioFormStyles";
function luminance(hex:string) {
  const channels=[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
  return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
}
function contrast(a:string,b:string) {const values=[luminance(a),luminance(b)].sort((x,y)=>x-y);return (values[1]+0.05)/(values[0]+0.05);}
describe("important CTA contrast",()=>{
  it.each(["normal","hover","focus","disabled"] as const)("keeps normal-size text AA in %s, independent of surrounding theme",state=>{
    const colors=natoriPrimaryActionColors[state];
    expect(contrast(colors.foreground,colors.background)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(["normal","hover"] as const)("keeps the softer portfolio CTA text AA in %s",state=>{
    const colors=natoriSoftActionColors[state];
    expect(contrast(colors.foreground,colors.background)).toBeGreaterThanOrEqual(4.5);
  });
  it("preserves brand decoration, transaction art, and form input state colors",()=>{
    expect(portfolioColors.action).toBe("#EC4899");
    expect(portfolioColors.actionText).toBe("#EC4899");
    expect(legacyNatoriTransactionColors.pink).toBe("#FF6FA5");
    expect(portfolioFormColors.formBorder).toBe("#878287");
    expect(portfolioFormColors.formBorderActive).toBe(portfolioColors.accentText);
    expect(portfolioFormColors.error).toBe("#B42318");
  });
});
