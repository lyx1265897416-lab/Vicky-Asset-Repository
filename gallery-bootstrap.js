// Paint the small HTML shell first; fetch the versioned catalogue and app in parallel.
(() => {
  const config=document.currentScript.dataset;
  const message=document.getElementById('gallery-loading');
  const retry=document.getElementById('gallery-load-retry');
  let running=false;
  async function load(){
    if(running)return;
    running=true;retry.hidden=true;
    message.firstChild.textContent='正在加载资产目录…';
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch(config.catalog,{cache:'force-cache',signal:controller.signal});
      if(!response.ok)throw Error('目录加载失败');
      window.__galleryManifest=await response.json();
      clearTimeout(timeout);
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src=config.app;
        script.onload=resolve;
        script.onerror=()=>{script.remove();reject(Error('页面加载失败'))};
        document.body.append(script);
      });
      message.hidden=true;
      delete window.__galleryManifest;
    }catch(error){
      message.firstChild.textContent='暂未加载成功，请重试。';retry.hidden=false;
    }finally{clearTimeout(timeout);running=false}
  }
  retry.onclick=load;load();
})();
