import {describe,expect,it} from "vitest";
import {defaultPortfolioContent} from "../../constants/portfolioContent";
import {projectPortfolioPublicContent} from "../portfolioPublicContent";

describe("public portfolio boundary",()=>{
  it("removes hidden work, links and dependent artwork without changing the saved content",()=>{
    const hidden={...defaultPortfolioContent.works[0],id:"private-work",published:false,
      title:"PRIVATE_TITLE_CANARY",image:"https://assets.invalid/PRIVATE_IMAGE_CANARY.webp",
      relatedLinks:[{id:"private-link",kind:"usage" as const,label:"PRIVATE_LINK_CANARY",href:"https://private.invalid/PRIVATE_LINK_CANARY"}]};
    const shown={...defaultPortfolioContent.works[0],id:"public-work",published:true,image:"https://assets.invalid/public.webp"};
    const stored={...defaultPortfolioContent,works:[hidden,shown],heroImage:hidden.image,
      heroImages:[hidden.image,shown.image],aboutImage:hidden.image,
      plans:[{...defaultPortfolioContent.plans[0],sampleWorkId:hidden.id}],
      massProductionSamples:[{id:"private-sample",name:"PRIVATE_SAMPLE_CANARY",image:hidden.image}],
      processVideo:{url:"https://youtu.be/abcdefghijk",posterWorkId:hidden.id}};
    const before=JSON.stringify(stored),result=projectPortfolioPublicContent(stored);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    expect(result.works.map(work=>work.id)).toEqual([shown.id]);
    expect(result.heroImages).toEqual([shown.image]);
    expect(result.plans[0].sampleWorkId).toBeNull();
    expect(result.processVideo?.posterWorkId).toBeNull();
    expect(JSON.stringify(stored)).toBe(before);
  });
  it("excludes disabled video URL and caption while keeping legacy published video",()=>{
    const video={url:"https://youtu.be/abcdefghijk",caption:"PRIVATE_VIDEO_CANARY",published:false};
    expect(projectPortfolioPublicContent({...defaultPortfolioContent,processVideo:video}).processVideo).toBeUndefined();
    expect(projectPortfolioPublicContent({...defaultPortfolioContent,processVideo:{...video,published:true}}).processVideo?.url).toBe(video.url);
  });
  it("preserves ordinary published gallery artwork and display workflow provenance",()=>{
    const result=projectPortfolioPublicContent({...defaultPortfolioContent,workflowProjectionAllowed:false});
    expect(result.works.map(work=>work.image)).toEqual(defaultPortfolioContent.works.map(work=>work.image));
    expect(result.workflowProjectionAllowed).toBe(false);
    expect(result.workflow).toEqual(defaultPortfolioContent.workflow);
  });
});
