"use strict";

// All persisted records come from the same-origin API. Session storage holds only
// this tab's unsent draft/answers and is partitioned by the authenticated user ID.
(() => {
  const $ = (id) => document.getElementById(id);
  const view = document.body.dataset.view;
  const fields = [
    ["situation", "S", "상황", "Situation"],
    ["task", "T", "과제", "Task"],
    ["action", "A", "행동", "Action"],
    ["result", "R", "결과", "Result"],
  ];
  let userId = null;
  let authenticated = false;
  let busy = false;
  let sessionBusy = false;
  let record = null;
  let records = [];
  let filter = "all";
  let draftTimer;
  let toastTimer;
  let stage = 1;
  let editDirty = false;
  let deleting = false;
  let storageOK = true;
  const detailId = view === "detail" ? Number(location.pathname.split("/").filter(Boolean).at(-1)) : null;
  const loginURL = "/login?next=" + encodeURIComponent(location.pathname);
  $("session-link").href = loginURL;
  $("session-login").href = loginURL;
  document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
  document.querySelector(`[data-nav="${view === "create" ? "create" : "list"}"]`)?.setAttribute("aria-current", "page");

  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function toast(text) {
    clearTimeout(toastTimer);
    $("toast").textContent = text;
    $("toast").hidden = false;
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4500);
  }
  function showError(error, retry = false) {
    let text = typeof error === "string" ? error : "서버에 연결하지 못했어요. 입력 내용은 유지됩니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.";
    if (error.status === 401 || error.status === 403) text = "로그인이 만료되었어요. 다시 로그인한 뒤 이어서 진행해 주세요.";
    else if (error.status === 404) text = "경험을 찾을 수 없어요. 삭제되었거나 접근할 수 없는 경험입니다.";
    else if (error.status === 422 || error.status === 400) text = "입력 내용을 처리하지 못했어요. 필수 입력과 답변을 확인해 주세요.";
    else if (error.status === 429) text = "요청이 많아 잠시 기다려야 해요. 잠시 후 다시 시도해 주세요.";
    else if (error.status >= 500) text = "서버에서 요청을 처리하지 못했어요. 입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.";
    else if (error.name === "AbortError") text = "응답이 예상보다 오래 걸리고 있어요. 요청은 서버에서 처리되었을 수 있으니 내 경험 목록을 먼저 확인한 뒤 다시 시도해 주세요.";
    $("page-error-text").textContent = text;
    $("page-retry").hidden = !retry;
    $("page-error").hidden = false;
    $("page-error").focus();
  }
  function clearError() { $("page-error").hidden = true; }
  async function request(path, method = "GET", payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), method === "POST" && path.includes("/api/experiences/") ? 180000 : 20000);
    try {
      const response = await fetch(path, {
        method, credentials: "same-origin", cache: "no-store", signal: controller.signal,
        headers: { Accept: "application/json", ...(payload === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error("Request failed");
        error.status = response.status;
        if (response.status === 401 || response.status === 403) setSignedOut();
        throw error;
      }
      if (data === null) throw new Error("Invalid JSON response");
      return data;
    } finally { clearTimeout(timer); }
  }
  function validRecord(data, needsQuestions = false) {
    return data && Number.isSafeInteger(data.experience_id) && data.experience_id > 0 &&
      data.star && typeof data.star === "object" && fields.every(([key]) => data.star[key] == null || typeof data.star[key] === "string") &&
      (!needsQuestions || (Array.isArray(data.follow_up) && data.follow_up.every(q => Number.isSafeInteger(q.question_id) && typeof q.question === "string" && fields.some(([key]) => key === q.type))));
  }
  function storageKey(kind = "draft") { return `jasoseodam:${userId ?? "guest"}:${kind}`; }
  function readSaved(kind) {
    try { return JSON.parse(sessionStorage.getItem(storageKey(kind)) || "null"); }
    catch { storageOK = false; return null; }
  }
  function save(kind, value) {
    try { sessionStorage.setItem(storageKey(kind), JSON.stringify(value)); storageOK = true; }
    catch { storageOK = false; }
  }
  function removeSaved(kind) { try { sessionStorage.removeItem(storageKey(kind)); } catch { storageOK = false; } }
  function saveDraft() {
    if (!$("experience-form") || stage !== 1) return;
    save("draft", { title: $("experience-title").value, exp: $("experience-body").value });
    $("draft-status").textContent = storageOK ? "✓ 이 탭에 임시 보관됨" : "임시 보관이 불가능해요. 페이지를 떠나기 전에 내용을 복사해 주세요.";
  }
  function restoreDraft() {
    if (view !== "create") return;
    const draft = readSaved("draft");
    if (draft && typeof draft.title === "string" && typeof draft.exp === "string") {
      $("experience-title").value = draft.title;
      $("experience-body").value = draft.exp;
      if (draft.title || draft.exp) $("draft-status").textContent = "✓ 이 탭에 보관한 내용을 불러왔어요.";
    }
    countCharacters();
  }
  function countCharacters() {
    if ($("character-count")) $("character-count").textContent = `${Array.from($("experience-body").value).length.toLocaleString("ko-KR")}자`;
  }
  function answers() {
    return (record?.follow_up || []).map(q => ({ question_id: q.question_id, answer: $("answer-" + q.question_id)?.value.trim() || "" }));
  }
  function saveAnswers() {
    const values = answers();
    save(`answers:${record.experience_id}`, values);
    $("answers-status").textContent = storageOK ? "✓ 답변을 이 탭에 임시 보관했어요." : "임시 보관이 불가능해요. 답변을 따로 복사해 주세요.";
    $("answer-progress").textContent = `${values.filter(a => a.answer).length} / ${values.length} 답변`;
  }
  function changeStage(next, focus = true) {
    stage = next;
    ["write", "refine", "result"].forEach((name, index) => { $(name + "-stage").hidden = index + 1 !== next; });
    $("edit-stage").hidden = true;
    $("workspace").hidden = false;
    $("delete-zone").hidden = !record || next === 1;
    document.querySelectorAll("[data-step]").forEach(el => {
      const n = Number(el.dataset.step);
      el.classList.toggle("is-complete", n < next);
      if (n === next) el.setAttribute("aria-current", "step"); else el.removeAttribute("aria-current");
    });
    if (focus && next > 1) $(next === 2 ? "refine-title" : "result-heading").focus();
  }
  function setBusy(value, final = false) {
    busy = value;
    $("busy-panel").hidden = !value;
    $("busy-title").textContent = final ? "답변을 더해, 이야기를 완성하고 있어요." : "경험 속 이야기를 발견하고 있어요.";
    $("busy-description").textContent = final ? "나의 행동과 결과에서 강점을 찾고 있어요." : "상황, 과제, 행동, 결과를 차근차근 연결하는 중이에요.";
    $("workspace").inert = value;
    $("edit-stage").inert = value;
    $("main").setAttribute("aria-busy", String(value));
    if (value) $("busy-panel").focus();
  }
  function renderStar(target, star) {
    target.replaceChildren();
    fields.forEach(([key, letter, label, english]) => {
      const row = node("div", "star-entry");
      row.append(node("span", "star-letter", letter));
      const content = node("div");
      const heading = node("h3", "", label);
      heading.append(node("small", "", english));
      content.append(heading, node("p", star[key]?.trim() ? "" : "missing", star[key]?.trim() || "아직 구체적인 내용이 없어요."));
      row.append(content);
      target.append(row);
    });
  }
  function renderTags(target, tags) {
    target.replaceChildren();
    (Array.isArray(tags) ? tags : []).filter(t => typeof t === "string").forEach(tag => target.append(node("span", "", "# " + tag)));
  }
  function renderQuestions(focus = true) {
    $("analysis-title").textContent = record.title;
    $("original-experience").textContent = record.original_exp;
    renderStar($("initial-star"), record.star);
    $("questions").replaceChildren();
    const saved = readSaved(`answers:${record.experience_id}`);
    const restored = Array.isArray(saved) ? saved : [];
    record.follow_up.forEach((q, index) => {
      const block = node("div", "question-block");
      const meta = fields.find(([key]) => key === q.type);
      const category = node("div", "question-category");
      category.append(node("span", "soft-badge", `${meta[1]} · ${meta[2]}`), node("span", "question-number", `QUESTION ${String(index + 1).padStart(2, "0")}`));
      const label = node("label", "", q.question);
      label.htmlFor = "answer-" + q.question_id;
      const input = node("textarea");
      input.id = label.htmlFor;
      input.rows = 4;
      input.required = true;
      input.placeholder = "내가 했던 행동과 생각을 구체적으로 적어 주세요.";
      input.value = restored.find(a => a.question_id === q.question_id)?.answer ?? q.answer ?? "";
      input.setAttribute("aria-describedby", input.id + "-error");
      const error = node("p", "field-error");
      error.id = input.id + "-error";
      error.hidden = true;
      input.addEventListener("input", () => { input.removeAttribute("aria-invalid"); error.hidden = true; saveAnswers(); });
      block.append(category, label, input, error);
      $("questions").append(block);
    });
    $("no-questions").hidden = record.follow_up.length > 0;
    $("answer-progress").textContent = `${answers().filter(a => a.answer).length} / ${record.follow_up.length} 답변`;
    changeStage(2, focus);
  }
  function renderResult(focus = true) {
    $("result-title").textContent = record.title;
    $("result-original").textContent = record.original_exp;
    $("result-status").textContent = record.status === "completed" ? "정리 완료 · 저장됨" : "정리 중";
    renderTags($("result-tags"), record.tags);
    renderStar($("result-star"), record.star);
    changeStage(3, focus);
    document.title = `${record.title} · 자소서담`;
  }
  function setSignedOut() {
    authenticated = false;
    $("session-notice").hidden = false;
    $("session-text").textContent = "경험을 분석하고 저장하려면 로그인이 필요해요.";
    $("session-login").hidden = false;
    $("session-link").textContent = "로그인";
    $("session-link").href = loginURL;
    if ($("analyze-button")) $("analyze-button").disabled = true;
    if (view !== "create" || stage !== 1) {
      if ($("workspace")) $("workspace").hidden = true;
      if ($("edit-stage")) $("edit-stage").hidden = true;
      if ($("collection")) $("collection").hidden = true;
    }
  }
  async function checkSession() {
    if (sessionBusy || busy) return;
    sessionBusy = true;
    $("session-retry").hidden = true;
    try {
      const data = await request("/api/auth/session");
      if (typeof data.authenticated !== "boolean") throw new Error("Invalid session");
      if (!data.authenticated) { setSignedOut(); return; }
      if (!Number.isSafeInteger(data.user_id)) throw new Error("Invalid user ID");
      const changed = userId !== data.user_id;
      if (changed && userId !== null) { authenticated = false; location.reload(); return; }
      const wasAuthenticated = authenticated;
      const guestDraft = userId === null && view === "create" ? readSaved("draft") : null;
      userId = data.user_id;
      authenticated = true;
      $("session-notice").hidden = true;
      $("session-login").hidden = true;
      $("session-link").textContent = "내 경험";
      $("session-link").href = "/experience/me";
      if ($("analyze-button")) $("analyze-button").disabled = false;
      if (changed) {
        if (view === "create") {
          if (!readSaved("draft") && guestDraft) {
            save("draft", guestDraft);
            try { sessionStorage.removeItem("jasoseodam:guest:draft"); } catch { /* The editor remains usable without storage. */ }
          }
          restoreDraft();
          const pending = readSaved("pending");
          if (validRecord(pending, true) && typeof pending.title === "string" && typeof pending.original_exp === "string") { record = pending; renderQuestions(false); }
        } else await loadPage();
      } else if (!wasAuthenticated) {
        if (record) { if (record.status === "completed") renderResult(false); else renderQuestions(false); }
        else if (view !== "create") await loadPage();
      }
    } catch (error) {
      authenticated = false;
      if ($("analyze-button")) $("analyze-button").disabled = true;
      $("session-notice").hidden = false;
      $("session-text").textContent = "로그인 상태를 확인하지 못했어요. 연결 상태를 확인해 주세요.";
      $("session-retry").hidden = false;
    } finally { sessionBusy = false; }
  }
  async function loadPage() {
    if (!authenticated || busy) return;
    clearError();
    if (view === "list") {
      $("collection-loading").hidden = false;
      $("collection").hidden = true;
      try {
        const data = await request("/api/experiences");
        if (!Array.isArray(data) || !data.every(r => Number.isSafeInteger(r.experience_id) && typeof r.title === "string")) throw new Error("Invalid list");
        records = data;
        renderList();
        $("collection").hidden = false;
      } catch (error) { showError(error, true); }
      finally { $("collection-loading").hidden = true; }
    } else if (view === "detail") {
      if (!Number.isSafeInteger(detailId) || detailId < 1) { showError("올바르지 않은 경험 주소예요. 내 경험 목록에서 다시 선택해 주세요."); return; }
      $("page-title").textContent = "나의 경험을 이어서 살펴보세요.";
      $("page-description").textContent = "나만의 이야기를 보완하고, 나의 언어로 다듬어 보세요.";
      try {
        const data = await request(`/api/experiences/${detailId}`);
        if (!validRecord(data, true) || data.experience_id !== detailId || typeof data.title !== "string") throw new Error("Invalid detail");
        record = data;
        if (record.status === "completed") renderResult(false); else renderQuestions(false);
      } catch (error) { showError(error, true); }
    }
  }
  function renderList() {
    const query = $("experience-search").value.trim().toLocaleLowerCase();
    const visible = records.filter(r => (filter === "all" || (filter === "completed" ? r.status === "completed" : r.status !== "completed")) && `${r.title} ${(r.tags || []).join(" ")}`.toLocaleLowerCase().includes(query));
    $("experience-list").replaceChildren();
    $("collection-count").textContent = `전체 ${records.length}개의 경험 중 ${visible.length}개`;
    visible.forEach(r => {
      const card = node("a", "surface experience-card");
      card.href = `/experience/${r.experience_id}`;
      card.append(node("span", "soft-badge", r.status === "completed" ? "✓ 정리 완료" : "✦ 정리 중"), node("h2", "", r.title));
      const tags = node("div", "experience-tags");
      renderTags(tags, r.tags);
      const footer = node("div", "card-footer");
      footer.append(node("span", "", r.status === "completed" ? "나의 이야기 살펴보기" : "추가 질문 이어서 답하기"), node("span", "", "↗"));
      card.append(tags, footer);
      $("experience-list").append(card);
    });
    $("empty-state").hidden = visible.length > 0;
    $("empty-title").textContent = records.length ? "조건에 맞는 경험이 없어요." : "첫 경험을 담아 볼까요?";
    $("empty-description").textContent = records.length ? "다른 검색어나 정리 상태로 다시 찾아보세요." : "대단한 성과가 아니어도 좋아요. 기억나는 순간부터 시작해 보세요.";
    $("empty-create").hidden = records.length > 0;
  }
  function validate(input, errorId, message) {
    const invalid = !input.value.trim();
    input.setAttribute("aria-invalid", String(invalid));
    $(errorId).textContent = invalid ? message : "";
    $(errorId).hidden = !invalid;
    return !invalid;
  }
  $("experience-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || sessionBusy) return;
    clearError();
    const titleOK = validate($("experience-title"), "title-error", "경험을 알아볼 수 있는 제목을 적어 주세요.");
    const bodyOK = validate($("experience-body"), "body-error", "정리하고 싶은 경험을 적어 주세요.");
    if (!titleOK || !bodyOK) { $(!titleOK ? "experience-title" : "experience-body").focus(); return; }
    await checkSession();
    if (!authenticated) { $("session-login").focus(); return; }
    const payload = { title: $("experience-title").value.trim(), exp: $("experience-body").value.trim() };
    saveDraft();
    setBusy(true);
    let failure;
    try {
      const result = await request("/api/experiences/initialize", "POST", payload);
      if (!validRecord(result, true)) throw new Error("Invalid analysis");
      record = { ...result, title: payload.title, original_exp: payload.exp, status: "processing", tags: [] };
      save("pending", record);
      renderQuestions(false);
    } catch (error) { failure = error; }
    finally { setBusy(false); }
    if (failure) showError(failure); else $("refine-title").focus();
  });
  $("followup-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || sessionBusy || !record) return;
    await checkSession();
    if (!authenticated) return;
    clearError();
    let firstInvalid;
    record.follow_up.forEach(q => {
      const input = $("answer-" + q.question_id);
      if (!validate(input, input.id + "-error", "답변을 적어 주세요. 기억나지 않는 경우에도 그대로 알려 주세요.")) firstInvalid ||= input;
    });
    if (firstInvalid) { firstInvalid.focus(); return; }
    saveAnswers();
    setBusy(true, true);
    let failure;
    try {
      const result = await request("/api/experiences/improve", "POST", { experience_id: record.experience_id, follow_up: answers() });
      if (!validRecord(result) || result.experience_id !== record.experience_id || !Array.isArray(result.tags)) throw new Error("Invalid result");
      record = { ...record, ...result, status: "completed" };
      if (readSaved("pending")?.experience_id === record.experience_id) { removeSaved("pending"); removeSaved("draft"); }
      removeSaved(`answers:${record.experience_id}`);
      renderResult(false);
      // Refreshing now loads the saved result via the detail endpoint.
      if (view === "create") history.replaceState(null, "", `/experience/${record.experience_id}`);
    } catch (error) { failure = error; }
    finally { setBusy(false); }
    if (failure) showError(failure); else $("result-heading").focus();
  });
  function resultText() {
    return [record.title, "", ...fields.flatMap(([key, letter, label]) => [`${letter} · ${label}`, record.star[key] || "(내용 없음)", ""]), "역량: " + (record.tags || []).join(", ")].join("\n");
  }
  $("copy-result")?.addEventListener("click", async () => {
    if (!record) return;
    try { await navigator.clipboard.writeText(resultText()); toast("정리한 경험을 복사했어요."); }
    catch { toast("복사 권한을 확인하거나 텍스트 다운로드를 이용해 주세요."); }
  });
  $("download-result")?.addEventListener("click", () => {
    if (!record) return;
    const url = URL.createObjectURL(new Blob(["\uFEFF", resultText()], { type: "text/plain;charset=utf-8" }));
    const link = node("a");
    link.href = url;
    link.download = `${record.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 80) || "나의 경험"}_STAR.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("정리한 경험을 텍스트 파일로 내려받습니다.");
  });
  $("edit-result")?.addEventListener("click", () => {
    if (!record || busy) return;
    $("edit-title").value = record.title;
    $("edit-tags").value = (record.tags || []).join(", ");
    $("edit-star-fields").replaceChildren();
    fields.forEach(([key, letter, label]) => {
      const container = node("div", "editor-field");
      const caption = node("label", "", `${letter} · ${label}`);
      // Keep field IDs separate from action buttons such as #edit-result.
      caption.htmlFor = `edit-star-${key}`;
      const input = node("textarea");
      input.id = caption.htmlFor;
      input.rows = 4;
      input.value = record.star[key] || "";
      container.append(caption, input);
      $("edit-star-fields").append(container);
    });
    editDirty = false;
    $("workspace").hidden = true;
    $("edit-stage").hidden = false;
    $("edit-heading").focus();
  });
  $("edit-form")?.addEventListener("input", () => { editDirty = true; });
  $("cancel-edit")?.addEventListener("click", () => { editDirty = false; clearError(); renderResult(); });
  $("edit-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || sessionBusy || !record) return;
    await checkSession();
    if (!authenticated) return;
    if (!$("edit-title").value.trim()) { showError("경험 제목을 입력해 주세요."); $("edit-title").focus(); return; }
    clearError();
    // PATCH only changed fields, so unrelated content is never overwritten.
    const payload = {};
    const title = $("edit-title").value.trim();
    const tags = [...new Set($("edit-tags").value.split(",").map(t => t.trim()).filter(Boolean))];
    if (title !== record.title) payload.title = title;
    if (JSON.stringify(tags) !== JSON.stringify(record.tags || [])) payload.tags = tags;
    fields.forEach(([key]) => {
      const value = $("edit-star-" + key).value.trim();
      if (value !== (record.star[key] ?? "").trim()) payload[key] = value;
    });
    if (!Object.keys(payload).length) {
      editDirty = false;
      renderResult();
      toast("변경된 내용이 없어요.");
      return;
    }
    const button = $("edit-form").querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = "저장 중…";
    busy = true;
    $("edit-form").inert = true;
    try {
      await request(`/api/experiences/${record.experience_id}`, "PATCH", payload);
      if (Object.hasOwn(payload, "title")) record.title = payload.title;
      if (Object.hasOwn(payload, "tags")) record.tags = payload.tags;
      fields.forEach(([key]) => { if (Object.hasOwn(payload, key)) record.star[key] = payload[key]; });
      editDirty = false;
      renderResult();
      toast("수정 내용을 저장했어요.");
    } catch (error) { showError(error); }
    finally { busy = false; $("edit-form").inert = false; button.disabled = false; button.textContent = "수정 내용 저장 ✓"; }
  });
  const deleteDialog = $("delete-dialog");
  $("delete-experience")?.addEventListener("click", () => {
    if (busy || deleting || !record || !authenticated) return;
    $("delete-title").textContent = record.title;
    $("delete-error").hidden = true;
    deleteDialog.showModal();
  });
  $("cancel-delete")?.addEventListener("click", () => { if (!deleting) deleteDialog.close(); });
  deleteDialog?.addEventListener("cancel", event => { if (deleting) event.preventDefault(); });
  $("confirm-delete")?.addEventListener("click", async () => {
    if (!deleteDialog.open || busy || sessionBusy || deleting || !record) return;
    deleting = true;
    $("confirm-delete").disabled = true;
    $("cancel-delete").disabled = true;
    $("confirm-delete").textContent = "삭제 중…";
    $("delete-error").hidden = true;
    deleteDialog.setAttribute("aria-busy", "true");
    let deleted = false;
    try {
      await checkSession();
      if (!authenticated) { deleteDialog.close(); return; }
      busy = true;
      await request(`/api/experiences/${record.experience_id}`, "DELETE");
      if (readSaved("pending")?.experience_id === record.experience_id) {
        removeSaved("pending");
        removeSaved("draft");
      }
      removeSaved(`answers:${record.experience_id}`);
      record = null;
      editDirty = false;
      stage = 3;
      deleted = true;
      deleteDialog.close();
    } catch (error) {
      if (!authenticated) { deleteDialog.close(); showError(error); }
      else {
        $("delete-error").textContent = error.name === "AbortError"
          ? "삭제 여부를 확인하지 못했어요. 창을 닫고 내 경험 목록에서 먼저 확인해 주세요."
          : error.status === 404 ? "경험을 찾을 수 없어요. 이미 삭제되었는지 내 경험 목록에서 확인해 주세요."
          : "삭제하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.";
        $("delete-error").hidden = false;
        $("delete-error").focus();
      }
    } finally {
      busy = false;
      deleting = false;
      $("confirm-delete").disabled = false;
      $("cancel-delete").disabled = false;
      $("confirm-delete").textContent = "삭제하기";
      deleteDialog.setAttribute("aria-busy", "false");
    }
    if (deleted) location.assign("/experience/me");
  });
  ["experience-title", "experience-body"].forEach(id => $(id)?.addEventListener("input", () => {
    countCharacters();
    $(id).removeAttribute("aria-invalid");
    $(id === "experience-title" ? "title-error" : "body-error").hidden = true;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 350);
  }));
  $("session-retry").addEventListener("click", checkSession);
  $("page-retry").addEventListener("click", loadPage);
  $("experience-search")?.addEventListener("input", renderList);
  $("restart-experience")?.addEventListener("click", () => {
    if (busy || !record) return;
    saveAnswers();
    if (readSaved("pending")?.experience_id === record.experience_id) removeSaved("pending");
    removeSaved("draft");
    location.assign("/experience/create");
  });
  document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
    filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(el => el.setAttribute("aria-pressed", String(el === button)));
    renderList();
  }));
  window.addEventListener("beforeunload", event => {
    if (view === "create" && stage === 1) saveDraft();
    if (busy || editDirty || (!storageOK && stage < 3 && ($("experience-body")?.value || record))) { event.preventDefault(); event.returnValue = ""; }
  });
  window.addEventListener("pageshow", event => { if (event.persisted) location.reload(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkSession(); });
  if (view === "create") {
    restoreDraft();
    $("experience-body").placeholder = $("experience-body").placeholder.replace(/\\n/g, "\n");
  }
  checkSession();
})();
