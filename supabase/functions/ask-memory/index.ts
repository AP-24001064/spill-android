import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  const auth=req.headers.get("Authorization"); if(!auth) return json({error:"Sign in first"},401);
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,openai=Deno.env.get("OPENAI_API_KEY")!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error}=await userClient.auth.getUser(); if(error||!user) return json({error:"Invalid session"},401);
  try {
    const {question}=await req.json(); const q=String(question??"").trim(); if(!q) return json({error:"Enter a question"},400);
    const embResponse=await fetch("https://api.openai.com/v1/embeddings",{method:"POST",headers:{"Authorization":"Bearer "+openai,"Content-Type":"application/json"},body:JSON.stringify({model:"text-embedding-3-small",input:q})});
    if(!embResponse.ok) throw new Error("Embedding failed: "+await embResponse.text());
    const emb=await embResponse.json();
    const admin=createClient(url,service);
    const {data:matches,error:searchError}=await admin.rpc("match_memories",{p_user_id:user.id,p_embedding:emb.data[0].embedding,p_match_count:8});
    if(searchError) throw searchError;
    const memories=matches??[];
    if(!memories.length) return json({answer:"I couldn't find a saved memory related to that yet.",sources:[]});
    const completion=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+openai,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini",temperature:0,messages:[
      {role:"system",content:"Answer the user's question using only the provided saved memories. If they do not contain the answer, say so. Do not invent dates or facts. Be concise."},
      {role:"user",content:"Question: "+q+"\nSaved memories:\n"+memories.map((m:any)=>"- ["+m.kind+"] "+m.title+": "+m.content).join("\n")}
    ]})});
    if(!completion.ok) throw new Error("Answer generation failed: "+await completion.text());
    const result=await completion.json();
    return json({answer:result.choices?.[0]?.message?.content??"I couldn't form an answer.",sources:memories.map((m:any)=>({id:m.id,title:m.title,kind:m.kind}))});
  } catch(e) { return json({error:e instanceof Error?e.message:"Search failed"},500); }
});