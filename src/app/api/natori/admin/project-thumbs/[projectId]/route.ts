import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { readNatoriProjectThumb } from "@/features/natori/server/projectThumbsService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
const headers = {"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
export const GET = withNatoriManagement("project-thumbs.image.GET",false,async (
  _request:Request, {params}:{params:Promise<{projectId:string}>},
) => {
  const {projectId} = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) return new Response(null,{status:404,headers});
  try {
    const image = await readNatoriProjectThumb(projectId);
    return image ? new Response(image.stream(),{headers:{...headers,"Content-Type":"image/webp"}}) : new Response(null,{status:404,headers});
  } catch {
    return new Response(null,{status:503,headers});
  }
});
