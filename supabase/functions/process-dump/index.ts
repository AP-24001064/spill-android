import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers:{...cors,"Content-Type":"application/json"} });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:cors});
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  const auth = req.headers.get("Authorization");
  if (!auth) return json({error:"Sign in first"},401);
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, openai=Deno.env.get("OPENAI_API_KEY")!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user) return json({error:"Invalid session"},401);
  const admin=createClient(url,service);
  try {
    const body=await req.json();
    let transcript=String(body.text ?? "").trim();
    const audioPath=typeof body.audioPath==="string"?body.audioPath:null;
    if(audioPath) {
      if(!audioPath.startsWith(user.id+"/")) return json({error:"Invalid audio path"},403);
      const {data:audio,error}=await admin.storage.from("dumps-audio").download(audioPath);
      if(error||!audio) throw new Error("Could not load uploaded audio");
      const form=new FormData();
      form.append("file",audio,"dump.m4a");
      form.append("model","gpt-4o-mini-transcribe");
      const tr=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{Authorization:"Bearer "+openai},body:form});
      if(!tr.ok) throw new Error("Transcription failed: "+await tr.text());
      const result=await tr.json(); transcript=[transcript,result.text??""].filter(Boolean).join("\n");
    }
    if(!transcript) return json({error:"Add text or record audio"},400);
    const {data:dump,error:dumpError}=await admin.from("dumps").insert({user_id:user.id,transcript,audio_path:audioPath}).select("id").single();
    if(dumpError) throw dumpError;
    const extraction=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+openai,"Content-Type":"application/json"},body:JSON.stringify({
      model:"gpt-4o-mini",temperature:0,response_format:{type:"json_object"},
      messages:[{role:"system",content:"Extract durable memory items from a personal brain dump. Return JSON {items:[{kind:'task|idea|note|follow_up|person|event',title:string,content:string,due_at:string|null,tags:string[]}]}. Use only supported facts. Use ISO-8601 due_at only when a clear date exists; otherwise null. Do not invent details. Keep useful details."},{role:"user",content:transcript}]
    })});
    if(!extraction.ok) throw new Error("Extraction failed: "+await extraction.text());
    const extracted=await extraction.json();
    const parsed=JSON.parse(extracted.choices?.[0]?.message?.content??'{"items":[]}');
    const items=Array.isArray(parsed.items)?parsed.items.slice(0,40):[];
    const rows=[];
    for(const item of items) {
      const title=String(item.title??"").trim(), content=String(item.content??"").trim();
      if(!title||!content) continue;
      const embRes=await fetch("https://api.openai.com/v1/embeddings",{method:"POST",headers:{"Authorization":"Bearer "+openai,"Content-Type":"application/json"},body:JSON.stringify({model:"text-embedding-3-small",input:title+"\n"+content})});
      if(!embRes.ok) throw new Error("Embedding failed: "+await embRes.text());
      const emb=await embRes.json();
      rows.push({user_id:user.id,dump_id:dump.id,kind:["task","idea","note","follow_up","person","event"].includes(item.kind)?item.kind:"note",title,content,due_at:item.due_at||null,tags:Array.isArray(item.tags)?item.tags.filter((t:unknown)=>typeof t==="string").slice(0,10):[],embedding:emb.data[0].embedding});
    }
    if(rows.length) { const {error}=await admin.from("memories").insert(rows); if(error) throw error; }
    return json({dumpId:dump.id,transcript,count:rows.length});
  } catch(e) { return json({error:e instanceof Error?e.message:"Processing failed"},500); }
});