import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export const promptFile='prompts/precise-followup-v21.json';
const promptBytes=readFileSync(new URL('../'+promptFile,import.meta.url));
export const prompts=JSON.parse(promptBytes);
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }

// No keys, HTTP headers, provider error bodies or material contents are logged.
export function createModelClient({base,model,key,timeout=45000,maxBytes=1200000,maxTokens=4096,tokenField='max_tokens',temperature=0.2,thinking='disabled',beforeRequest,trace}={}){
  return async function call(stage,payload){
    if(!base||!model||!key)throw new ApiError(503,'真实 AI 尚未配置完整，请在本机 .env 配置服务地址、模型和密钥后重启。');
    if(!['parse','analyze','rewrite'].includes(stage))throw new ApiError(400,'未知的模型处理步骤。');
    if(!['disabled','enabled'].includes(thinking))throw new ApiError(503,'AI_THINKING 只能设为 disabled 或 enabled。');
    let endpoint;
    try{
      endpoint=new URL(base);
      if(endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error();
      if(endpoint.protocol!=='https:'&&!(endpoint.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)))throw Error();
      endpoint.pathname=endpoint.pathname.replace(/\/$/,'')+'/chat/completions';
    }catch{throw new ApiError(503,'AI_BASE_URL 必须为 HTTPS 地址（仅本地服务可使用 HTTP），且不能含凭据、查询参数或片段。');}
    const messages=[{role:'system',content:prompts.shared+'\n'+prompts[stage]},{role:'user',content:JSON.stringify(payload)}];
    const request={model,messages,...(endpoint.hostname==='api.deepseek.com'?{thinking:{type:thinking}}:{}),response_format:{type:'json_object'},[tokenField]:maxTokens,...(temperature===null||thinking==='enabled'?{}:{temperature})};
    await beforeRequest?.({stage,request});
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout),started=Date.now();
    try{
      const response=await fetch(endpoint,{method:'POST',signal:controller.signal,redirect:'error',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(request)});
      if(!response.ok)throw new ApiError(response.status===429?429:502,`AI 服务调用失败（HTTP ${response.status}），未采用结果。请稍后手动重试当前步骤。`);
      const chunks=[];let size=0;
      for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes){controller.abort();throw new ApiError(422,'AI 返回内容超限，未采用。');}chunks.push(chunk);}
      const raw=Buffer.concat(chunks).toString('utf8');
      await trace?.({stage,request,response:raw});
      let envelope,data;
      try{
        envelope=JSON.parse(raw);const choice=envelope.choices?.[0];
        if(!choice||choice.message?.refusal||choice.message?.tool_calls||choice.finish_reason&&choice.finish_reason!=='stop'||typeof choice.message?.content!=='string')throw Error();
        data=JSON.parse(choice.message.content);
        if(!data||Array.isArray(data)||typeof data!=='object')throw Error();
      }catch{throw new ApiError(422,'AI 输出不是完整 JSON，或已截断、拒绝回答，未采用。请重试当前步骤。');}
      const usage=Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens','prompt_cache_hit_tokens','prompt_cache_miss_tokens'].map(k=>[k,Number.isInteger(envelope.usage?.[k])&&envelope.usage[k]>=0?envelope.usage[k]:null]));
      return {data,meta:{stage,promptVersion:prompts.version,promptSHA256:sha256(promptBytes),requestedModel:model,thinking:endpoint.hostname==='api.deepseek.com'?thinking:null,returnedModel:typeof envelope.model==='string'?envelope.model:null,usage,durationMs:Date.now()-started,inputSHA256:sha256(JSON.stringify(request)),outputSHA256:sha256(raw)}};
    }catch(e){
      if(e instanceof ApiError)throw e;
      if(controller.signal.aborted)throw new ApiError(504,'AI 请求超时，已保留现有内容。请稍后重试当前步骤。');
      throw new ApiError(502,'无法连接 AI 服务，已保留现有内容。请检查配置与网络后重试。');
    }finally{clearTimeout(timer);}
  };
}
