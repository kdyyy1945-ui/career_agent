// Run with: node app/pages/static/js/tests/experience.test.cjs
// Small DOM fixture for workflow tests; no browser, live account, or database writes.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../experience.js'), 'utf8');
const templates = { create: 'experience_create', detail: 'experience_detail', list: 'experience_me' };

function environment(view = 'create', options = {}) {
  const elements = new Map(), special = [], events = {}, calls = [];
  const storage = new Map(Object.entries(options.storage || {}));
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag; this.children = []; this.listeners = {}; this.attrs = {}; this.dataset = {};
      this.hidden = false; this.value = ''; this.placeholder = ''; this.textContent = ''; this.disabled = false;
      this.classList = { toggle() {}, add() {}, remove() {} };
    }
    // Browser getElementById returns the first element, not the most recently
    // assigned duplicate. Keep that behavior so button/textarea collisions fail.
    set id(id) { this._id = id; if (!elements.has(id)) elements.set(id, this); }
    get id() { return this._id; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) {
      const detach = el => {
        el.children.forEach(detach);
        if (elements.get(el.id) === el) elements.delete(el.id);
      };
      this.children.forEach(detach);
      this.children = nodes;
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    removeAttribute(k) { delete this.attrs[k]; }
    addEventListener(k, v) { (this.listeners[k] ||= []).push(v); }
    focus() { doc.activeElement = this; }
    querySelector(q) { return q === '[type="submit"]' ? (this.submit ||= new Element('button')) : null; }
    click() { return this.fire('click'); }
    showModal() { this.open = true; }
    close() { this.open = false; }
    remove() {}
    async fire(kind) { for (const cb of this.listeners[kind] || []) await cb({ preventDefault() {}, target: this }); }
  }
  const html = fs.readFileSync(path.join(__dirname, '../../../templates/' + templates[view] + '.html'), 'utf8');
  for (const match of html.matchAll(/<([a-z0-9]+)\b([^>]*)>/gi)) {
    const el = new Element(match[1]);
    const id = /\bid="([^"]+)"/.exec(match[2]);
    if (id) el.id = id[1];
    for (const a of match[2].matchAll(/data-([a-z]+)="([^"]+)"/g)) el.dataset[a[1]] = a[2];
    if (/\bhidden\b/.test(match[2])) el.hidden = true;
    if (/\bdisabled\b/.test(match[2])) el.disabled = true;
    if (/data-year\b/.test(match[2])) el.dataset.year = '';
    if (/data-(nav|step|year|filter)\b/.test(match[2])) special.push(el);
  }
  const doc = {
    body: new Element('body'), getElementById: id => elements.get(id) || null,
    createElement: tag => new Element(tag), visibilityState: 'visible', addEventListener: (k, v) => { events[k] = v; },
    querySelector: q => special.find(e => e.dataset.nav === /data-nav="([^"]+)"/.exec(q)?.[1]),
    querySelectorAll: q => special.filter(e => Object.hasOwn(e.dataset, q.slice(6, -1))),
  };
  doc.body.dataset.view = view;
  const star = options.star || { situation: '상황', task: '과제', action: '행동', result: null };
  const initial = { experience_id: 17, star, follow_up: options.noQuestions ? [] : [{ question_id: 31, type: 'result', question: '무엇이 달라졌나요?' }] };
  const detail = { ...initial, title: '테스트 경험', original_exp: '직접 행동한 경험', status: options.processing ? 'processing' : 'completed', tags: ['협업'] };
  let fail = options.fail;
  const context = {
    document: doc, console, Array, Number, Object, String, Set, JSON, Error, AbortController, Blob,
    location: { pathname: view === 'detail' ? '/experience/17' : '/experience/' + (view === 'list' ? 'me' : 'create'), reload() { context.reloaded = true; }, assign(url) { context.url = url; } },
    history: { replaceState(a, b, url) { context.url = url; } },
    URL: { createObjectURL() { return 'blob:mock'; }, revokeObjectURL() {} },
    navigator: { clipboard: { async writeText(t) { context.copied = t; } } },
    sessionStorage: {
      getItem: k => storage.get(k) || null,
      setItem: (k, v) => { if (options.storageFails) throw Error(); storage.set(k, v); },
      removeItem: k => storage.delete(k),
    },
    setTimeout: () => 1, clearTimeout() {}, window: { addEventListener: (k, v) => { events[k] = v; } },
    fetch: async (url, opts) => {
      calls.push({ path: url, method: opts.method, body: opts.body && JSON.parse(opts.body) });
      let status = 200, data;
      if (url === '/api/auth/session') data = { authenticated: !options.guest, user_id: options.guest ? null : (options.userId || 7) };
      else if (fail) { status = fail; data = { detail: 'error' }; }
      else if (url === '/api/experiences/initialize') data = initial;
      else if (url === '/api/experiences/improve') data = { experience_id: 17, star: { ...star, result: '성과가 개선됨' }, tags: ['협업', '문제해결'] };
      else if (url === '/api/experiences') data = options.empty ? [] : [detail, { ...detail, experience_id: 18, title: '두 번째 경험', status: 'processing', tags: [] }];
      else if (opts.method === 'PATCH') data = { message: '경험 수정 완료' };
      else if (opts.method === 'DELETE') data = { message: '경험 삭제 완료' };
      else data = detail;
      return { ok: status === 200, status, json: async () => data };
    },
  };
  vm.runInNewContext(source, context);
  return { get: id => elements.get(id), calls, context, storage, initial, special, setFail: v => { fail = v; }, flush: async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); } };
}

(async () => {
  const original = { situation: '상황 문장입니다.', task: '과제 문장입니다.', action: '행동 문장입니다.', result: '남길 결과 문장입니다. 삭제할 문장입니다.' };
  const regression = environment('detail', { star: original }); await regression.flush();
  await regression.get('edit-result').fire('click');
  // Select the actual rendered textarea, as a user does, without trusting its ID.
  const resultInput = regression.get('edit-star-fields').children[3].children[1];
  for (const field of regression.get('edit-star-fields').children) {
    const [label, input] = field.children;
    assert.equal(regression.get(input.id), input, 'Each textarea ID must resolve to that textarea');
    assert.equal(label.htmlFor, input.id);
  }
  resultInput.value = '남길 결과 문장입니다.';
  await regression.get('edit-form').fire('submit');
  const patch = regression.calls.find(c => c.method === 'PATCH').body;
  assert.equal(patch.result, '남길 결과 문장입니다.', 'Deleting one sentence must not erase the result');
  assert.deepEqual(Object.keys(patch), ['result'], 'Untouched fields must not be sent');
  await regression.get('copy-result').fire('click');
  for (const key of ['situation', 'task', 'action']) assert.ok(regression.context.copied.includes(original[key]), key + ' must survive');
  assert.ok(regression.context.copied.includes('남길 결과 문장입니다.'));
  await regression.get('edit-result').fire('click');
  await regression.get('edit-form').fire('submit');
  assert.equal(regression.calls.filter(c => c.method === 'PATCH').length, 1, 'Saving without changes must not overwrite anything');
  await regression.get('edit-result').fire('click');
  regression.get('edit-star-situation').value = '상황만 수정합니다.';
  await regression.get('edit-form').fire('submit');
  assert.deepEqual(regression.calls.filter(c => c.method === 'PATCH').at(-1).body, { situation: '상황만 수정합니다.' });
  await regression.get('copy-result').fire('click');
  assert.ok(regression.context.copied.includes('남길 결과 문장입니다.'), 'Editing S must preserve R');
  await regression.get('edit-result').fire('click');
  regression.get('edit-star-result').value = '';
  await regression.get('edit-form').fire('submit');
  assert.deepEqual(regression.calls.filter(c => c.method === 'PATCH').at(-1).body, { result: '' }, 'Intentional clearing must affect only the edited field');
  await regression.get('copy-result').fire('click');
  assert.ok(regression.context.copied.includes('상황만 수정합니다.'));
  const e = environment(); await e.flush();
  assert.equal(e.get('analyze-button').disabled, false);
  await e.get('experience-form').fire('submit');
  assert.equal(e.get('title-error').hidden, false);
  assert.equal(e.calls.filter(c => c.method === 'POST').length, 0);
  e.get('experience-title').value = '팀 프로젝트'; e.get('experience-body').value = '의견을 듣고 일정을 조율했어요.';
  await Promise.all([e.get('experience-form').fire('submit'), e.get('experience-form').fire('submit')]);
  assert.equal(e.calls.filter(c => c.path.endsWith('/initialize')).length, 1);
  assert.equal(e.get('refine-stage').hidden, false);
  assert.deepEqual(e.calls.find(c => c.path.endsWith('/initialize')).body, { title: '팀 프로젝트', exp: '의견을 듣고 일정을 조율했어요.' });
  await e.get('followup-form').fire('submit'); assert.equal(e.get('answer-31-error').hidden, false);
  e.get('answer-31').value = '기한 안에 완성했어요.'; await e.get('answer-31').fire('input');
  const restored = environment('create', { storage: Object.fromEntries(e.storage) }); await restored.flush();
  assert.equal(restored.get('answer-31').value, '기한 안에 완성했어요.');
  e.setFail(500); await e.get('followup-form').fire('submit');
  assert.equal(e.get('page-error').hidden, false); assert.equal(e.get('answer-31').value, '기한 안에 완성했어요.'); assert.equal(e.get('busy-panel').hidden, true);
  e.setFail(null); await e.get('followup-form').fire('submit');
  assert.equal(e.get('result-stage').hidden, false); assert.equal(e.context.url, '/experience/17');
  assert.deepEqual(e.calls.filter(c => c.path.endsWith('/improve')).at(-1).body, { experience_id: 17, follow_up: [{ question_id: 31, answer: '기한 안에 완성했어요.' }] });
  await e.get('copy-result').fire('click'); assert.ok(e.context.copied.includes('성과가 개선됨'));
  assert.equal(e.storage.has('jasoseodam:7:pending'), false);
  await e.get('edit-result').fire('click'); e.get('edit-title').value = '수정한 제목'; e.setFail(500); await e.get('edit-form').fire('submit');
  assert.equal(e.get('edit-stage').hidden, false); assert.equal(e.get('edit-title').value, '수정한 제목');
  e.setFail(null); await e.get('edit-form').fire('submit'); assert.equal(e.get('result-title').textContent, '수정한 제목');
  const n = environment('create', { noQuestions: true }); await n.flush();
  n.get('experience-title').value = '충분한 경험'; n.get('experience-body').value = '모든 STAR 내용'; await n.get('experience-form').fire('submit');
  assert.equal(n.get('no-questions').hidden, false); await n.get('followup-form').fire('submit'); assert.equal(n.get('result-stage').hidden, false);
  assert.deepEqual(n.calls.find(c => c.path.endsWith('/improve')).body.follow_up, []);
  const g = environment('create', { guest: true }); await g.flush();
  assert.equal(g.get('analyze-button').disabled, true); assert.equal(g.get('session-login').hidden, false); assert.equal(g.calls.length, 1);
  const l = environment('list'); await l.flush(); assert.equal(l.get('experience-list').children.length, 2);
  l.get('experience-search').value = '협업'; await l.get('experience-search').fire('input'); assert.equal(l.get('experience-list').children.length, 1);
  l.get('experience-search').value = '없는 제목'; await l.get('experience-search').fire('input'); assert.equal(l.get('empty-state').hidden, false);
  const le = environment('list', { fail: 500 }); await le.flush();
  assert.equal(le.get('page-retry').hidden, false); assert.equal(le.get('empty-state').hidden, true);
  le.setFail(null); await le.get('page-retry').fire('click'); assert.equal(le.get('collection').hidden, false);
  const d = environment('detail', { processing: true }); await d.flush(); assert.equal(d.get('refine-stage').hidden, false);
  const finished = environment('detail'); await finished.flush(); assert.equal(finished.get('result-stage').hidden, false);
  const transfer = environment('create', { storage: { 'jasoseodam:guest:draft': JSON.stringify({ title: '로그인 전 초안', exp: '작성 내용' }) } }); await transfer.flush();
  assert.equal(transfer.get('experience-title').value, '로그인 전 초안'); assert.ok(transfer.storage.has('jasoseodam:7:draft'));
  const noStorage = environment('create', { storageFails: true }); await noStorage.flush();
  noStorage.get('experience-title').value = '제목'; noStorage.get('experience-body').value = '내용'; await noStorage.get('experience-form').fire('submit');
  assert.equal(noStorage.get('refine-stage').hidden, false);
  const account = { userId: 7 }; const switched = environment('create', account); await switched.flush();
  switched.get('experience-title').value = '이전 사용자의 제목'; switched.get('experience-body').value = '이전 사용자의 내용'; account.userId = 8;
  await switched.get('experience-form').fire('submit');
  assert.equal(switched.context.reloaded, true); assert.equal(switched.calls.filter(c => c.method === 'POST').length, 0);
  const removal = environment('detail'); await removal.flush();
  assert.equal(removal.get('delete-zone').hidden, false);
  await removal.get('confirm-delete').fire('click');
  assert.equal(removal.calls.filter(c => c.method === 'DELETE').length, 0, 'Deletion requires an open confirmation');
  await removal.get('delete-experience').fire('click');
  assert.equal(removal.get('delete-dialog').open, true);
  assert.equal(removal.get('delete-title').textContent, '테스트 경험');
  await removal.get('cancel-delete').fire('click');
  assert.equal(removal.get('delete-dialog').open, false);
  assert.equal(removal.calls.filter(c => c.method === 'DELETE').length, 0, 'Cancel must not send DELETE');
  await removal.get('delete-experience').fire('click'); removal.setFail(500);
  await removal.get('confirm-delete').fire('click');
  assert.equal(removal.get('delete-dialog').open, true);
  assert.equal(removal.get('delete-error').hidden, false);
  assert.equal(removal.get('confirm-delete').disabled, false);
  assert.equal(removal.context.url, undefined, 'Failure must keep the experience visible');
  removal.setFail(null);
  await Promise.all([removal.get('confirm-delete').fire('click'), removal.get('confirm-delete').fire('click')]);
  assert.equal(removal.calls.filter(c => c.method === 'DELETE').length, 2, 'Only one request per confirmation, including retry');
  assert.equal(removal.calls.filter(c => c.method === 'DELETE').at(-1).path, '/api/experiences/17');
  assert.equal(removal.context.url, '/experience/me');
  assert.equal(removal.get('delete-dialog').open, false);
  const pendingDelete = environment('detail', { processing: true, storage: {
    'jasoseodam:7:pending': JSON.stringify({ experience_id: 18 }),
    'jasoseodam:7:answers:17': JSON.stringify([{ question_id: 31, answer: '답변' }]),
  } }); await pendingDelete.flush();
  assert.equal(pendingDelete.get('delete-zone').hidden, false, 'Processing experiences must also be deletable');
  await pendingDelete.get('delete-experience').fire('click'); await pendingDelete.get('confirm-delete').fire('click');
  assert.equal(pendingDelete.storage.has('jasoseodam:7:answers:17'), false);
  assert.equal(pendingDelete.storage.has('jasoseodam:7:pending'), true, 'Keep another experience draft');
  console.log('PASS: deletion confirmation/cancel, error/retry, duplicate prevention, processing/completed records, scoped draft cleanup; edit regression and all existing workflow tests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
