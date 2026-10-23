import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const nodes = new Map();
const node = id => {
  if (!nodes.has(id)) nodes.set(id, { disabled: false, hidden: true, style: {}, after() {} });
  return nodes.get(id);
};
let retry;
const requests = [];
const assets = ['a', 'b', 'c'].map(id => ({ title: id, generation: {
  asset_sha256: id, detail_url: id + '.json', text_to_image_prompt: 'loading',
} }));
const ctx = vm.createContext({ assets, modalIndex: 0,
  document: { getElementById: node, createElement: () => (retry = { style: {} }) },
  fetch: url => new Promise((resolve, reject) => requests.push({ url, resolve, reject })),
  renderGenerationDetails: asset => {
    node('detail-title').textContent = asset.title;
    node('generation-prompt').value = asset.generation.text_to_image_prompt;
  },
});
vm.runInContext(fs.readFileSync(new URL('../gallery-lazy-details.js', import.meta.url), 'utf8'), ctx);
const tick = () => new Promise(resolve => setImmediate(resolve));
const full = id => ({ asset_sha256: id, text_to_image_prompt: id + '-full', model: {}, dimensions: {} });
const respond = (index, record) => requests[index].resolve({ ok: true, json: async () => record });

ctx.renderGenerationDetails(assets[0]);
assert.equal(node('copy-prompt').disabled, true);
ctx.modalIndex = 1;
ctx.renderGenerationDetails(assets[1]);
respond(0, full('a'));
await tick();
assert.equal(node('detail-title').textContent, 'b', 'A late response must not replace B');
assert.equal(node('copy-prompt').disabled, true);
requests[1].reject(Error('offline'));
await tick();
assert.equal(retry.hidden, false, 'Failed requests must offer retry');
assert.equal(node('copy-prompt').disabled, true, 'Never copy a loading/error placeholder');
retry.onclick();
assert.equal(requests[2].url, 'b.json', 'Retry must issue a fresh request');
respond(2, full('b'));
await tick();
assert.equal(node('generation-prompt').value, 'b-full');
assert.equal(node('copy-prompt').disabled, false);
ctx.modalIndex = 2;
ctx.renderGenerationDetails(assets[2]);
respond(3, full('different-asset'));
await tick();
assert.equal(assets[2].generation.detail_url, 'c.json', 'Reject a mismatched record');
assert.equal(retry.hidden, false);
console.log('Passed: late navigation response, failed fetch, retry, copy gating, identity mismatch.');
