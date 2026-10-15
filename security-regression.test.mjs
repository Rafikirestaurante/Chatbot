import assert from 'node:assert/strict';
import handler from './api/gemini.ts';
const originalFetch=globalThis.fetch;
const originalKey=process.env.GEMINI_API_KEY;
function response(){return {code:0,body:null,status(n){this.code=n;return this},json(v){this.body=v;return this},end(){return this}}}
try {
  delete process.env.GEMINI_API_KEY;
  let called=0; globalThis.fetch=async()=>{called++;throw Error('unexpected')};
  let res=response();await handler({method:'POST',body:{input:'hola'}},res);assert.equal(res.code,503);assert.equal(called,0);
  res=response();await handler({method:'GET'},res);assert.equal(res.code,405);
  process.env.GEMINI_API_KEY='test-only';
  globalThis.fetch=async(url,options)=>{assert.ok(!url.includes(process.env.GEMINI_API_KEY));assert.ok(!url.includes('?key='));assert.equal(options.headers['x-goog-api-key'],process.env.GEMINI_API_KEY);return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({intent:'greeting',confidence:1,reply:'Hola'})}]}}]})}};
  res=response();await handler({method:'POST',body:{input:'hola',nowIso:new Date().toISOString(),preferences:{}}},res);assert.equal(res.code,200);
  globalThis.fetch=async()=>({ok:false,status:403,text:async()=>process.env.GEMINI_API_KEY});
  res=response();await handler({method:'POST',body:{input:'hola',preferences:{}}},res);assert.equal(res.code,502);assert.ok(!JSON.stringify(res.body).includes(process.env.GEMINI_API_KEY));
  globalThis.fetch=async()=>{throw Error(process.env.GEMINI_API_KEY)};
  res=response();await handler({method:'POST',body:{input:'hola',preferences:{}}},res);assert.equal(res.code,500);assert.ok(!JSON.stringify(res.body).includes(process.env.GEMINI_API_KEY));
  console.log('PASS: missing key, rejected method, server header, successful response, sanitized provider errors and exceptions. No live API calls.');
} finally {globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;}

