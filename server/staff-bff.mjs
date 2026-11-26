// Separate staff session. Neither staff tokens nor the server's admin key enter a browser response.
const cookie = "sa2_staff";
const uid = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
const permitted = [
  ["POST","auth/session"], ["GET","session"], ["DELETE","session"],
  ["POST","factor/secret"], ["POST","factor"],
  ["GET","ai/catalog"], ["POST","ai/catalog"], ["GET","ai/overview"],
  ["GET","ai/routes/(?:classify|draft|transcribe|image|document|chat|link)"],
  ["POST","ai/routes/(?:classify|draft|transcribe|image|document|chat|link)"],
  ["PUT","ai/budgets/"+uid], ["POST","ai/reprocess"],
].map(([method,path])=>({method,path:new RegExp("^"+path+"$")}));
const failure = (status,message)=>Object.assign(new Error(message),{status});
export function createStaffBff({apiOrigin,webOrigin,serviceKey,adminKey}) {
  const origin = new URL(webOrigin), scope = "; HttpOnly; SameSite=Strict; Path=/api/v2/staff" + (origin.protocol === "https:" ? "; Secure" : "");
  return async (req,res)=>{
    const send=(status,data)=>{res.statusCode=status;res.end(data===undefined?undefined:JSON.stringify(data));};
    res.setHeader("Cache-Control","private, no-store");
    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("X-Content-Type-Options","nosniff");
    try {
      if (!adminKey || adminKey.length<32 || adminKey===serviceKey) throw failure(404,"Central indisponível.");
      if (req.headers.host!==origin.host || req.headers["sec-fetch-site"]==="cross-site" || (req.method!=="GET" && req.headers.origin!==webOrigin)) throw failure(403,"Origem não permitida.");
      const path=req.url.slice("/api/v2/staff/".length);
      if (!permitted.some(r=>r.method===req.method && r.path.test(path))) throw failure(404,"Operação indisponível.");
      const login=req.method==="POST" && path==="auth/session", logout=req.method==="DELETE" && path==="session";
      const token=req.headers.cookie?.split(/;\s*/).find(x=>x.startsWith(cookie+"="))?.slice(cookie.length+1);
      const headers={"X-Service-Key":serviceKey,"X-Admin-Key":adminKey,Accept:"application/json"};
      if (!login) {
        if (!/^[a-f0-9]{64}$/.test(token || "")) throw failure(401,"Entre na Central para continuar.");
        headers.Authorization="Bearer "+token;
      }
      let body;
      if (["POST","PUT"].includes(req.method)) {
        if (req.headers["content-type"]?.split(";")[0]!=="application/json") throw failure(415,"Envie os dados em JSON.");
        const chunks=[];let length=0;
        for await (const chunk of req) {length+=chunk.length;if(length>16384)throw failure(413,"Formulário muito grande.");chunks.push(chunk);}
        body=Buffer.concat(chunks).toString();
        try {JSON.parse(body);} catch {throw failure(400,"Confira o formulário.");}
        headers["Content-Type"]="application/json";
      }
      const response=await fetch(apiOrigin+"/v1/admin/"+path,{method:req.method,body,headers,redirect:"error",signal:AbortSignal.timeout(12000)});
      if (response.status===401 && !login || logout && response.ok) res.setHeader("Set-Cookie",cookie+"=; Max-Age=0"+scope);
      if (response.status===204) return send(204);
      const data=await response.json();
      if (!response.ok) return send(response.status,{error:{code:data.error?.code || "request_failed",message:data.error?.message || "Não foi possível concluir a operação."}});
      if (login) {
        if (!/^[a-f0-9]{64}$/.test(data.token || "") || !data.session?.staff?.id) throw failure(502,"Sessão inválida.");
        res.setHeader("Set-Cookie",cookie+"="+data.token+scope);
        return send(200,data.session);
      }
      send(response.status,data);
    } catch(error) {send(error.status||503,{error:{message:error.status?error.message:"A Central está indisponível. Tente novamente."}});}
  };
}
