"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const view = document.body.dataset.jobView;
  const api = "/api/jobposting";
  const id = view === "detail" ? Number(location.pathname.split("/").filter(Boolean).at(-1)) : null;
  // This is the exact route published in OpenAPI (no slash before the ID).
  const researchPath = `/api/job_posting${id}/research`;
  const categories = [
    ["business", "핵심 사업·서비스"], ["issue", "기업 전략·최근 이슈"],
    ["responsibilities", "주요 담당 업무"], ["requirements", "필수 자격·역량"], ["preferences", "우대 사항"],
  ];
  const fields = [
    ["title", "공고 관리용 제목", "예: 하반기 백엔드 개발자 신입 채용", true, "text"],
    ["company_name", "회사명", "예: 지원할 회사 이름", true, "text"],
    ["position", "지원 직무", "예: 백엔드 개발자", true, "text"],
    ["end_at", "채용 마감일", "", false, "date"],
    ["job_posting_url", "채용공고 링크", "https://careers.example.com/jobs/123", false, "url"],
    ["job_posting_text", "채용공고 원문", "담당 업무, 지원 자격, 우대 사항 등 공고 내용을 그대로 붙여 넣어 주세요.", false, "textarea"],
  ];
  let record = null, records = [], filter = "all", owner = null;
  let busy = false, loading = false, sessionBusy = false, dirty = false;
  let research = null, toastTimer;
  const loginURL = "/login?next=" + encodeURIComponent(location.pathname);
  $("job-login").href = $("job-session-link").href = loginURL;
  document.querySelectorAll("[data-year]").forEach(el => { el.textContent = new Date().getFullYear(); });

  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function safeURL(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function validRecord(value) {
    return value && Number.isSafeInteger(value.id) && value.id > 0 &&
      ["title", "company_name", "position"].every(key => typeof value[key] === "string");
  }
  function validResearch(value) {
    return value && categories.every(([key]) => Array.isArray(value[key]) &&
      value[key].every(item => item && typeof item.title === "string" && typeof item.content === "string"));
  }
  function deadline(date) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { days: null, label: "마감일 미정", className: "" };
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((Date.parse(`${date}T00:00:00Z`) - today) / 86400000);
    if (!Number.isFinite(days)) return { days: null, label: "마감일 미정", className: "" };
    return { days, label: days < 0 ? "마감" : days === 0 ? "오늘 마감" : `D-${days}`,
      className: days < 0 ? "deadline-closed" : days <= 7 ? "deadline-soon" : "" };
  }
  function errorText(error, mutation = false) {
    if (typeof error === "string") return error;
    if ([401, 403].includes(error.status)) return "로그인이 만료되었어요. 다시 로그인해 주세요.";
    if (error.status === 404) return "공고를 찾을 수 없어요. 삭제되었거나 접근할 수 없는 공고입니다.";
    if (error.status === 422) return "입력 내용을 확인해 주세요. 필수 항목, 링크와 날짜 형식이 올바른지 확인해 주세요.";
    if (error.status === 429) return "요청이 많아요. 잠시 기다렸다가 다시 시도해 주세요.";
    if (mutation) return "완료 여부를 확인하지 못했어요. 서버에서 처리되었을 수 있으니 목록이나 저장된 결과를 먼저 확인해 주세요. 입력 내용은 유지됩니다.";
    if (error.status >= 500) return "서버에서 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
    return "연결 상태 또는 서버 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
  function showError(error, retry = false, mutation = false) {
    $("job-error-text").textContent = errorText(error, mutation);
    $("job-error").hidden = false;
    $("job-retry").hidden = !retry;
    $("job-error").focus();
  }
  function toast(text) {
    if (!$("job-toast")) return;
    clearTimeout(toastTimer);
    $("job-toast").textContent = text;
    $("job-toast").hidden = false;
    toastTimer = setTimeout(() => { $("job-toast").hidden = true; }, 5000);
  }
  async function request(path, method = "GET", payload, timeout = 20000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(path, {
        method, credentials: "same-origin", cache: "no-store", signal: controller.signal,
        headers: { Accept: "application/json", ...(payload === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      if (!response.ok) {
        const error = new Error("API request failed");
        error.status = response.status;
        if ([401, 403].includes(response.status)) signedOut();
        throw error;
      }
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  function signedOut() {
    $("job-workspace").hidden = true;
    $("job-session").hidden = false;
    $("job-session-text").textContent = "내 채용공고를 확인하려면 로그인해 주세요.";
    $("job-login").hidden = false;
    $("job-session-retry").hidden = false;
    $("job-session-link").textContent = "로그인";
    $("job-session-link").href = loginURL;
  }
  async function checkSession() {
    const session = await request("/api/auth/session");
    if (typeof session?.authenticated !== "boolean") throw new Error("Invalid session");
    if (!session.authenticated) { signedOut(); return false; }
    if (owner !== null && String(owner) !== String(session.user_id)) {
      // Do not submit an old account's unsaved form into a different account.
      dirty = false; setBusy(false);
      location.reload();
      return false;
    }
    owner = session.user_id;
    $("job-session").hidden = true;
    $("job-session-link").textContent = "내 경험";
    $("job-session-link").href = "/experience/me";
    return true;
  }
  function setBusy(value) {
    busy = value;
    ["job-save", "job-cancel", "job-edit", "job-delete", "research-run", "research-refresh", "job-delete-confirm", "job-delete-cancel"].forEach(key => {
      if ($(key)) $(key).disabled = value;
    });
    $("job-form")?.querySelectorAll("input, textarea").forEach(el => { el.disabled = value; });
    $("job-form")?.setAttribute("aria-busy", String(value));
  }
  function buildForm() {
    if (!$("job-fields")) return;
    let row;
    for (const [key, label, placeholder, required, type] of fields) {
      const wrapper = node("div", "editor-field");
      const caption = node("label", "", label + " ");
      caption.htmlFor = `field-${key}`;
      caption.append(node("span", "", required ? "필수" : "선택"));
      const input = node(type === "textarea" ? "textarea" : "input");
      input.id = `field-${key}`; input.name = key;
      if (type === "textarea") input.rows = 9;
      else input.type = type;
      input.required = required; input.placeholder = placeholder;
      input.setAttribute("aria-describedby", `error-${key}${key === "job_posting_url" ? " hint-url" : ""}`);
      const error = node("p", "job-field-error");
      error.id = `error-${key}`; error.hidden = true;
      wrapper.append(caption, input, error);
      if (key === "job_posting_url") {
        const hint = node("p", "field-hint", "http:// 또는 https://로 시작하는 공고 주소를 입력해 주세요.");
        hint.id = "hint-url"; wrapper.append(hint);
      }
      if (key === "company_name") { row = node("div", "job-field-row"); $("job-fields").append(row); }
      (["company_name", "position"].includes(key) ? row : $("job-fields")).append(wrapper);
      input.addEventListener("input", () => {
        dirty = true; error.hidden = true; input.removeAttribute("aria-invalid");
      });
    }
  }
  function fillForm(data) {
    fields.forEach(([key]) => {
      $(`field-${key}`).value = data[key] ?? "";
      $(`field-${key}`).removeAttribute("aria-invalid");
      $(`error-${key}`).hidden = true;
    });
    dirty = false;
  }
  function readForm() {
    const data = {};
    let firstInvalid = null;
    for (const [key, label, , required, type] of fields) {
      const input = $(`field-${key}`);
      const value = input.value.trim();
      let message = required && !value ? `${label}을(를) 입력해 주세요.` : "";
      if (value && type === "url" && !safeURL(value)) message = "올바른 http:// 또는 https:// 주소를 입력해 주세요.";
      if (type === "date" && (input.validity?.badInput || (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)))) message = "올바른 마감일을 입력해 주세요.";
      input.setAttribute("aria-invalid", String(Boolean(message)));
      $(`error-${key}`).textContent = message; $(`error-${key}`).hidden = !message;
      if (message && !firstInvalid) firstInvalid = input;
      data[key] = value || null;
    }
    firstInvalid?.focus();
    return firstInvalid ? null : data;
  }
  function renderList() {
    $("job-total").textContent = records.length;
    $("job-soon").textContent = records.filter(r => { const d = deadline(r.end_at).days; return d !== null && d >= 0 && d <= 7; }).length;
    $("job-researched").textContent = records.filter(r => validResearch(r.research)).length;
    const query = $("job-search").value.trim().toLocaleLowerCase();
    const visible = records.filter(r => {
      const days = deadline(r.end_at).days;
      return (filter === "all" || (filter === "open" && days !== null && days >= 0) ||
        (filter === "closed" && days !== null && days < 0) || (filter === "researched" && validResearch(r.research))) &&
        [r.title, r.company_name, r.position].some(s => s.toLocaleLowerCase().includes(query));
    }).sort((a, b) => {
      if ($("job-sort").value === "deadline") {
        const rank = r => { const days = deadline(r.end_at).days; return days === null ? 2 : days < 0 ? 1 : 0; };
        return rank(a) - rank(b) || (a.end_at || "9999").localeCompare(b.end_at || "9999") || b.id - a.id;
      }
      return b.id - a.id;
    });
    $("job-count").textContent = `${records.length}개의 공고 중 ${visible.length}개`;
    $("job-list").replaceChildren();
    for (const r of visible) {
      const card = node("a", "surface job-card");
      card.href = `/job-postings/${r.id}`;
      const top = node("div", "job-card-top");
      const d = deadline(r.end_at);
      top.append(node("span", "job-monogram", r.company_name.slice(0, 1) || "담"), node("span", `soft-badge ${d.className}`, d.label));
      const footer = node("div", "card-footer");
      footer.append(node("span", "", validResearch(r.research) ? "✦ 리서치 완료" : "리서치 시작하기"), node("span", "", "자세히 보기 ↗"));
      card.append(top, node("p", "job-card-company", r.company_name), node("h2", "", r.title), node("p", "job-card-position", r.position), footer);
      $("job-list").append(card);
    }
    $("job-empty").hidden = visible.length > 0;
    $("job-empty-title").textContent = records.length ? "조건에 맞는 공고가 없어요." : "첫 번째 기회를 담아 볼까요?";
    $("job-empty-description").textContent = records.length ? "다른 검색어나 필터로 다시 찾아보세요." : "관심 있는 공고를 저장하고, 기업과 직무를 더 깊이 알아보세요.";
    $("job-empty-create").hidden = records.length > 0;
    $("job-reset-filters").hidden = records.length === 0;
  }
  function renderDetail() {
    document.title = `${record.title} · 자소서담`;
    $("job-title").textContent = record.title;
    $("job-company").textContent = record.company_name;
    $("job-position").textContent = record.position;
    const d = deadline(record.end_at);
    $("job-deadline").textContent = d.label;
    $("job-deadline").className = `soft-badge ${d.className}`;
    $("job-end-date").textContent = record.end_at ? `마감일 ${record.end_at.replaceAll("-", ".")}` : "마감일을 등록하지 않았어요.";
    const url = safeURL(record.job_posting_url);
    $("job-original-link").hidden = !url;
    if (url) $("job-original-link").href = url;
    else $("job-original-link").removeAttribute("href");
    $("job-original-text").textContent = record.job_posting_text || "저장된 원문이 없어요. 공고 수정에서 원문을 추가하면 담당 업무와 지원 자격을 더 자세히 살펴볼 수 있어요.";
    renderResearch(record.research);
  }
  function renderResearch(data) {
    if (data != null && !validResearch(data)) throw new Error("Invalid research response");
    research = data;
    $("research-empty").hidden = !!data;
    $("research-results").hidden = !data;
    $("research-run").textContent = data ? "AI 리서치 다시 실행 ↻" : "AI 리서치 시작 ✦";
    $("research-sections").replaceChildren(); $("research-nav").replaceChildren();
    if (!data) return;
    categories.forEach(([key, title], index) => {
      const link = node("a", "", title); link.href = `#research-${key}`; $("research-nav").append(link);
      const section = node("section", "surface research-section"); section.id = `research-${key}`;
      section.setAttribute("aria-labelledby", `research-heading-${key}`);
      const heading = node("div", "research-section-heading");
      const h3 = node("h3", "", title); h3.id = `research-heading-${key}`;
      heading.append(node("span", "", `0${index + 1}`), h3); section.append(heading);
      if (!data[key].length) section.append(node("p", "research-no-items", "확인된 정보가 없어요. 공고 원문과 기업 자료를 함께 확인해 주세요."));
      data[key].forEach(item => {
        const article = node("article", "research-item");
        article.append(node("h4", "", item.title), node("p", "", item.content));
        const source = node("div", "research-source");
        const url = safeURL(item.source_url);
        if (url) {
          const anchor = node("a", "", `출처 확인 · ${new URL(url).hostname} ↗`);
          anchor.href = url; anchor.target = "_blank"; anchor.rel = "noopener noreferrer";
          source.append(anchor);
        } else source.append(node("span", "", "출처 링크 없음"));
        source.append(node("span", "", item.published_at ? `발행일 ${item.published_at}` : "발행일 미확인"));
        article.append(source); section.append(article);
      });
      $("research-sections").append(section);
    });
  }
  async function loadPage() {
    if (loading || busy) return;
    loading = true; $("job-error").hidden = true;
    if ($("job-loading")) $("job-loading").hidden = false;
    try {
      if (!await checkSession()) return;
      if (view === "list") {
        const data = await request(api);
        if (!Array.isArray(data) || !data.every(validRecord)) throw new Error("Invalid list");
        records = data; renderList();
      } else if (view === "detail") {
        if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error(), { status: 404 });
        const data = await request(`${api}/${id}`);
        if (!validRecord(data) || data.id !== id) throw new Error("Invalid record");
        record = data; renderDetail();
      }
      $("job-workspace").hidden = false;
    } catch (error) { showError(error, true); }
    finally { loading = false; if ($("job-loading")) $("job-loading").hidden = true; }
  }
  async function boot() {
    if (sessionBusy || busy) return;
    sessionBusy = true;
    try { await loadPage(); } finally { sessionBusy = false; }
  }

  buildForm();
  $("job-session-retry").addEventListener("click", boot);
  $("job-retry").addEventListener("click", loadPage);
  $("job-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || loading) return;
    const data = readForm();
    if (!data) return;
    setBusy(true); $("job-error").hidden = true;
    $("job-save").textContent = "저장 중…";
    try {
      if (!await checkSession()) return;
      const result = await request(view === "create" ? api : `${api}/${id}`, view === "create" ? "POST" : "PATCH", data);
      const savedId = view === "create" ? result.job_posting_id : result.id;
      if (!Number.isSafeInteger(savedId) || savedId < 1 || (view === "detail" && savedId !== id)) throw new Error("Invalid saved ID");
      dirty = false;
      if (view === "create") { setBusy(false); location.assign(`/job-postings/${savedId}`); return; }
      const changedResearchInput = ["company_name", "position", "job_posting_url", "job_posting_text"].some(key => record[key] !== data[key]);
      record = { ...record, ...data };
      renderDetail();
      if (research && changedResearchInput) $("research-stale").hidden = false;
      $("job-edit-panel").hidden = true; $("job-summary").hidden = false;
      $("job-edit").focus(); toast("공고 정보를 저장했어요.");
    } catch (error) { showError(error, false, true); }
    finally { setBusy(false); $("job-save").textContent = view === "create" ? "채용공고 담기 ↗" : "변경 내용 저장"; }
  });
  $("job-edit")?.addEventListener("click", () => {
    if (busy) return;
    fillForm(record); $("job-summary").hidden = true; $("job-edit-panel").hidden = false; $("form-title").focus();
  });
  $("job-cancel")?.addEventListener("click", () => {
    if (busy) return;
    if (dirty && !window.confirm("수정 중인 내용을 취소할까요?")) return;
    dirty = false; $("job-edit-panel").hidden = true; $("job-summary").hidden = false; $("job-edit").focus();
  });
  document.querySelectorAll("[data-job-filter]").forEach(button => button.addEventListener("click", () => {
    filter = button.dataset.jobFilter;
    document.querySelectorAll("[data-job-filter]").forEach(el => el.setAttribute("aria-pressed", String(el === button)));
    renderList();
  }));
  $("job-search")?.addEventListener("input", renderList);
  $("job-sort")?.addEventListener("change", renderList);
  $("job-reset-filters")?.addEventListener("click", () => {
    $("job-search").value = "";
    document.querySelector('[data-job-filter="all"]').click();
    $("job-search").focus();
  });
  async function fetchResearch() {
    try {
      const data = await request(researchPath);
      if (!validResearch(data)) throw new Error("Invalid research response");
      record.research = data; renderResearch(data);
      return true;
    } catch (error) {
      if (error.status !== 404) throw error;
      // Research GET also returns 404 when the parent record was deleted.
      const parent = await request(`${api}/${id}`);
      if (!validRecord(parent) || parent.id !== id) throw new Error("Invalid record");
      record.research = null; renderResearch(null);
      return false;
    }
  }
  $("research-refresh")?.addEventListener("click", async () => {
    if (busy || loading) return;
    setBusy(true); $("research-error").hidden = true;
    $("research-refresh").textContent = "불러오는 중…";
    try {
      if (!await checkSession()) return;
      const found = await fetchResearch();
      toast(found ? "저장된 리서치를 불러왔어요." : "아직 저장된 리서치가 없어요.");
    } catch (error) { $("research-error").textContent = errorText(error); $("research-error").hidden = false; }
    finally { setBusy(false); $("research-refresh").textContent = "저장된 결과 불러오기 ↻"; }
  });
  $("research-run")?.addEventListener("click", async () => {
    if (busy || loading) return;
    if (!$("job-edit-panel").hidden) { toast("공고 수정을 저장하거나 취소한 뒤 리서치를 실행해 주세요."); return; }
    if (record.job_posting_url && !safeURL(record.job_posting_url)) {
      $("research-error").textContent = "저장된 공고 링크가 올바르지 않아요. 공고 수정에서 링크를 수정하거나 비워 주세요.";
      $("research-error").hidden = false; return;
    }
    setBusy(true); $("research-error").hidden = true;
    $("research-progress").hidden = false;
    $("research-run").textContent = "리서치 진행 중…";
    $("research-results").setAttribute("aria-busy", "true");
    let generated = false;
    try {
      if (!await checkSession()) return;
      const result = await request(researchPath, "POST", undefined, 300000);
      if (result?.id !== id) throw new Error("Invalid research result");
      generated = true;
      if (!await fetchResearch()) throw new Error("Missing generated research");
      $("research-stale").hidden = true;
      toast("리서치를 완료하고 저장했어요.");
    } catch (error) {
      $("research-error").textContent = generated
        ? "리서치는 완료되었지만 결과를 불러오지 못했어요. ‘저장된 결과 불러오기’를 눌러 주세요."
        : errorText(error, true) + " 기존 리서치가 있다면 아래에서 계속 확인할 수 있어요.";
      $("research-error").hidden = false;
    } finally {
      setBusy(false); $("research-progress").hidden = true;
      $("research-results").setAttribute("aria-busy", "false");
      $("research-run").textContent = research ? "AI 리서치 다시 실행 ↻" : "AI 리서치 시작 ✦";
    }
  });
  $("job-delete")?.addEventListener("click", () => {
    if (busy) return;
    $("job-delete-name").textContent = record.title;
    $("job-delete-error").hidden = true; $("job-delete-dialog").showModal();
  });
  $("job-delete-cancel")?.addEventListener("click", () => { if (!busy) $("job-delete-dialog").close(); });
  $("job-delete-dialog")?.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
  $("job-delete-confirm")?.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true); $("job-delete-confirm").textContent = "삭제 중…";
    try {
      if (!await checkSession()) { $("job-delete-dialog").close(); return; }
      const result = await request(`${api}/${id}`, "DELETE");
      if (typeof result?.message !== "string") throw new Error("Invalid delete response");
      dirty = false; setBusy(false); location.assign("/job-postings/me");
    } catch (error) { $("job-delete-error").textContent = errorText(error, true); $("job-delete-error").hidden = false; }
    finally { setBusy(false); $("job-delete-confirm").textContent = "공고 삭제"; }
  });
  window.addEventListener("beforeunload", event => {
    if (dirty || busy) { event.preventDefault(); event.returnValue = ""; }
  });
  window.addEventListener("pageshow", event => { if (event.persisted) { dirty = false; location.reload(); } });
  boot();
})();
