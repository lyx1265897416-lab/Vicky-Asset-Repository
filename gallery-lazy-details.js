/* Hosted exports keep full generation records out of the initial catalog. */
(() => {
  const baseRender = renderGenerationDetails;
  const pending = new Map();
  const copy = document.getElementById('copy-prompt');
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = '重新加载详情';
  retry.hidden = true;
  retry.style.minHeight = '44px';
  copy.after(retry);
  const current = asset => modalIndex >= 0 && assets[modalIndex] === asset;
  renderGenerationDetails = function (asset) {
    baseRender(asset);
    const url = asset.generation.detail_url;
    copy.disabled = Boolean(url);
    retry.hidden = true;
    if (!url) return;
    document.getElementById('original-content').textContent = '正在加载生成记录…';
    retry.onclick = () => renderGenerationDetails(asset);
    if (!pending.has(url)) {
      pending.set(url, fetch(url).then(response => {
        if (!response.ok) throw Error('Generation record unavailable');
        return response.json();
      }).then(record => {
        if (record.asset_sha256 !== asset.generation.asset_sha256 ||
            typeof record.text_to_image_prompt !== 'string' || !record.model || !record.dimensions) {
          throw Error('Generation record mismatch');
        }
        return record;
      }).catch(error => { pending.delete(url); throw error; }));
    }
    pending.get(url).then(record => {
      asset.generation = record;
      if (!current(asset)) return;
      baseRender(asset);
      copy.disabled = false;
      retry.hidden = true;
    }).catch(() => {
      if (!current(asset)) return;
      document.getElementById('generation-prompt').value = '完整提示词暂未加载成功，请重试；也可下载生成记录查看。';
      document.getElementById('original-content').textContent = '生成记录暂未加载成功。';
      document.getElementById('copy-status').textContent = '详情加载失败，可重试或下载记录。';
      retry.hidden = false;
    });
  };
})();
