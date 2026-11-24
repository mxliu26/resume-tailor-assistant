const DATABASE='youju.resume.files.v1',STORE='pdfs';
let libraryPromise;
export function pdfLibrary(){
  return libraryPromise??=import('./vendor/pdfjs/pdf.min.mjs').then(pdf=>{
    pdf.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
    return pdf;
  }).catch(error=>{libraryPromise=undefined;throw error;});
}
export async function openPdf(blob){
  const pdf=await pdfLibrary();
  return pdf.getDocument({data:new Uint8Array(await blob.arrayBuffer()),
    cMapUrl:new URL('./vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,
    standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,
    wasmUrl:new URL('./vendor/pdfjs/wasm/',import.meta.url).href,isEvalSupported:false});
}
function database(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(Error('无法访问本机 PDF 存储，请检查浏览器存储设置后重试。'));
    request.onblocked=()=>reject(Error('PDF 存储正在更新，请关闭其他 Demo 标签页后重试。'));
  });
}
async function transaction(mode,operation){
  const db=await database();
  return new Promise((resolve,reject)=>{
    let result;
    const tx=db.transaction(STORE,mode),request=operation(tx.objectStore(STORE));
    request.onsuccess=()=>{result=request.result;};
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=tx.onabort=()=>{db.close();reject(Error('PDF 原件未能保存或读取，请检查本机存储空间后重试。'));};
  });
}
export async function savePdfSource(file,maxFileBytes=5242880){
  if(!file.name.toLowerCase().endsWith('.pdf')||await file.slice(0,5).text()!=='%PDF-')throw Error('请选择有效的 PDF 原件。');
  if(file.size>maxFileBytes)throw Error(`PDF 不能超过 ${Math.round(maxFileBytes/1048576)} MB。`);
  const loading=await openPdf(file);let document;
  loading.onPassword=()=>loading.destroy();
  try{
    document=await loading.promise;
    if(document.numPages>50)throw Error('PDF 超过 50 页，请选择需要核对的简历文件。');
    const metadata={id:crypto.randomUUID(),name:file.name,size:file.size,pages:document.numPages,createdAt:new Date().toISOString()};
    await transaction('readwrite',store=>store.put({...metadata,blob:new Blob([file],{type:'application/pdf'})}));
    return metadata;
  }catch(error){
    if(error.name==='InvalidPDFException'||error.name==='PasswordException'||/destroyed/.test(error.message))throw Error('PDF 无法打开或需要密码，请选择可直接打开的原 PDF。');
    throw error;
  }finally{await loading.destroy();}
}
export const readPdfSource=id=>transaction('readonly',store=>store.get(id));
export const clearPdfSources=()=>transaction('readwrite',store=>store.clear());
export async function exportPdfSources(db){
  const ids=[...new Set([db.createInput,...db.tasks,...db.bases,...db.versions.map(v=>v.snapshot)].map(record=>record?.resumePdf?.id).filter(Boolean))];
  const attachments=[];
  for(const id of ids){
    const record=await readPdfSource(id);if(!record)continue;
    const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(record.blob);});
    const {blob,...metadata}=record;attachments.push({...metadata,dataUrl});
  }
  return attachments;
}
