"use strict";

// All URLs are same-origin. Authentication is handled by the server's session cookie.
// Only the session endpoint determines the home page's authentication display.
// null means unknown (loading or unavailable), not signed out.
let sessionController;
let sessionVersion = 0;
let homeLogoutPending = false;
function renderHomeSession(loggedIn) {
  const guest = document.getElementById("home-guest-actions");
  const member = document.getElementById("home-member-actions");
  if (!guest || !member) return;
  guest.hidden = loggedIn !== false;
  member.hidden = loggedIn !== true;
  document.getElementById("home-session-actions").hidden = loggedIn !== null;
  // Signed-in visitors can start organizing an experience immediately.
  document.querySelectorAll('.hero-actions > a.button, .closing > a.button').forEach((link) => {
    if (!link.dataset.guestHref) {
      link.dataset.guestHref = link.getAttribute("href");
      link.dataset.guestLabel = link.firstChild.textContent;
    }
    link.setAttribute("href", loggedIn ? "/experience/create" : link.dataset.guestHref);
    link.firstChild.textContent = loggedIn ? "내 경험 정리하기 " : link.dataset.guestLabel;
  });
}

async function refreshHomeSession() {
  if (!document.getElementById("home-member-actions") || homeLogoutPending) return;
  const version = ++sessionVersion;
  sessionController?.abort();
  const controller = new AbortController();
  sessionController = controller;
  const timer = setTimeout(() => controller.abort(), 15000);
  const status = document.getElementById("home-session-status");
  const retry = document.getElementById("home-session-retry");
  status.textContent = "로그인 상태 확인 중…";
  retry.hidden = true;
  renderHomeSession(null);
  try {
    const response = await fetch("/api/auth/session", {
      method: "GET",
      headers: { "Accept": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    if (version !== sessionVersion) return;
    if (response.status === 401) { renderHomeSession(false); return; }
    if (!response.ok) throw new Error("Session lookup failed");
    const session = await response.json();
    if (version !== sessionVersion) return;
    if (typeof session?.authenticated !== "boolean") throw new Error("Invalid session response");
    renderHomeSession(session.authenticated);
  } catch {
    if (version !== sessionVersion) return;
    renderHomeSession(null);
    status.textContent = "로그인 상태 확인 실패";
    retry.hidden = false;
  } finally {
    clearTimeout(timer);
  }
}
document.getElementById("home-session-retry")?.addEventListener("click", refreshHomeSession);
refreshHomeSession();
window.addEventListener("pageshow", (event) => { if (event.persisted) refreshHomeSession(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshHomeSession();
});

const homeLogout = document.getElementById("home-logout");
homeLogout?.addEventListener("click", async () => {
  if (homeLogout.disabled) return;
  const message = document.getElementById("home-auth-message");
  homeLogoutPending = true;
  ++sessionVersion;
  sessionController?.abort();
  homeLogout.disabled = true;
  homeLogout.textContent = "로그아웃 중…";
  message.hidden = true;
  try {
    await apiRequest("/api/auth/logout", {});
    renderHomeSession(false);
    message.classList.add("info");
    message.textContent = "로그아웃되었습니다.";
    document.querySelector('#home-guest-actions a').focus();
  } catch {
    message.classList.remove("info");
    message.textContent = "로그아웃하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.";
  } finally {
    message.hidden = false;
    homeLogout.disabled = false;
    homeLogout.textContent = "로그아웃";
    homeLogoutPending = false;
  }
});

document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});

const examples = {
  team: { before: "“팀 프로젝트에서 팀장을 맡았어요.”", strength: "조율하는 힘, 함께 만드는 결과", s: "팀원들의 의견 차이로 프로젝트가 지연됐어요.", t: "팀장으로서 방향을 정하고 일정을 맞춰야 했어요.", a: "의견을 정리하고 공통의 기준으로 역할을 나눴어요.", r: "합의한 일정 안에 프로젝트를 완성했어요.", tag: "#소통 역량　#협업　#문제 해결" },
  work: { before: "“카페에서 아르바이트를 했어요.”", strength: "작은 불편을 발견하고, 더 나은 방법으로", s: "주문이 몰리는 시간에 음료가 잘못 전달되곤 했어요.", t: "고객이 정확한 주문을 받을 방법이 필요했어요.", a: "주문 번호를 함께 확인하는 절차를 제안했어요.", r: "주문을 다시 확인하는 혼선이 줄어들었어요.", tag: "#고객 중심　#관찰력　#업무 개선" },
  club: { before: "“동아리에서 신입 부원을 모집했어요.”", strength: "상대의 관점에서, 참여의 문턱을 낮추다", s: "홍보 글을 올려도 가입 문의가 많지 않았어요.", t: "처음 보는 사람도 활동을 이해하도록 알려야 했어요.", a: "실제 활동 사진과 자주 묻는 질문을 정리했어요.", r: "활동에 관심을 가진 학생들과 상담을 이어갔어요.", tag: "#기획력　#공감　#실행력" },
};
const exampleTabs = [...document.querySelectorAll("[data-example]")];
function selectExample(tab) {
  const example = examples[tab.dataset.example];
  exampleTabs.forEach((item) => {
    item.setAttribute("aria-selected", String(item === tab));
    item.tabIndex = item === tab ? 0 : -1;
  });
  document.getElementById("example-panel").setAttribute("aria-labelledby", tab.id);
  ["before", "strength", "tag"].forEach((key) => {
    document.getElementById(`example-${key}`).textContent = example[key];
  });
  ["s", "t", "a", "r"].forEach((key) => {
    document.getElementById(`star-${key}`).textContent = example[key];
  });
}
exampleTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectExample(tab));
  tab.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % exampleTabs.length;
    if (event.key === "ArrowLeft") next = (index - 1 + exampleTabs.length) % exampleTabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = exampleTabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      exampleTabs[next].focus();
      selectExample(exampleTabs[next]);
    }
  });
});

document.querySelectorAll("[data-password]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.password);
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    button.setAttribute("aria-pressed", String(visible));
    const label = input.id === "password-confirm" ? "비밀번호 확인" : "비밀번호";
    button.setAttribute("aria-label", `${label} ${visible ? "숨기기" : "표시"}`);
  });
});

async function apiRequest(path, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error("API request failed");
      error.status = response.status;
      error.detail = data?.detail;
      throw error;
    }
    // A proxy's HTML error or login page must never be treated as API success.
    if (!data || typeof data.message !== "string") throw new Error("Invalid API response");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

const form = document.getElementById("auth-form");
if (form) {
  const isRegister = document.body.dataset.page === "register";
  const submitButton = document.getElementById("auth-submit");
  const buttonLabel = submitButton.querySelector("[data-button-label]");
  const message = document.getElementById("form-message");
  const entry = document.getElementById("auth-entry");
  const success = document.getElementById("auth-success");
  const fields = [...form.querySelectorAll("input")];
  let pending = false;

  function fieldError(input, text) {
    input.setAttribute("aria-invalid", String(Boolean(text)));
    const error = document.getElementById(`${input.id}-error`);
    error.textContent = text;
    error.hidden = !text;
  }
  function showMessage(text, info = false) {
    message.textContent = text;
    message.classList.toggle("info", info);
    message.hidden = false;
    message.focus();
  }
  function setPending(value) {
    pending = value;
    submitButton.disabled = value;
    submitButton.setAttribute("aria-busy", String(value));
    form.setAttribute("aria-busy", String(value));
    fields.forEach((input) => { input.disabled = value; });
    form.querySelectorAll("[data-password]").forEach((button) => { button.disabled = value; });
    buttonLabel.textContent = value ? (isRegister ? "가입 처리 중…" : "로그인 중…") : (isRegister ? "회원가입" : "로그인");
  }
  fields.forEach((input) => input.addEventListener("input", () => {
    fieldError(input, "");
    message.hidden = true;
    if (input.id === "password" && isRegister) fieldError(form.elements.password_confirm, "");
  }));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pending) return;
    message.hidden = true;
    fields.forEach((input) => fieldError(input, ""));
    const loginId = form.elements.login_id;
    const password = form.elements.password;
    // Preserve the exact credentials: the backend does not normalize IDs or passwords.
    const data = { login_id: loginId.value, password: password.value };
    let firstInvalid = null;
    function invalid(input, text) {
      fieldError(input, text);
      firstInvalid ||= input;
    }
    if (isRegister) {
      const name = form.elements.name;
      data.name = name.value;
      if (Array.from(name.value.trim()).length < 2) invalid(name, "이름을 2자 이상 입력해 주세요.");
    }
    if (!loginId.value.trim()) invalid(loginId, "아이디를 입력해 주세요.");
    else if (isRegister && Array.from(loginId.value.trim()).length < 2) invalid(loginId, "아이디를 2자 이상 입력해 주세요.");
    if (!password.value) invalid(password, "비밀번호를 입력해 주세요.");
    else if (isRegister && Array.from(password.value).length < 2) invalid(password, "비밀번호를 2자 이상 입력해 주세요.");
    if (isRegister && (!form.elements.password_confirm.value || password.value !== form.elements.password_confirm.value)) {
      invalid(form.elements.password_confirm, "비밀번호가 일치하지 않습니다.");
    }
    if (firstInvalid) { firstInvalid.focus(); return; }

    setPending(true);
    try {
      await apiRequest(isRegister ? "/api/auth/register" : "/api/auth/login", data);
      form.reset();
      form.querySelectorAll("[data-password]").forEach((button) => {
        document.getElementById(button.dataset.password).type = "password";
        button.setAttribute("aria-pressed", "false");
        button.setAttribute("aria-label", button.dataset.password === "password-confirm" ? "비밀번호 확인 표시" : "비밀번호 표시");
      });
      entry.hidden = true;
      success.hidden = false;
      success.focus();
      document.title = isRegister ? "가입 완료 · 자소서담" : "로그인 완료 · 자소서담";
      if (!isRegister) {
        const next = new URLSearchParams(window.location.search).get("next");
        window.location.assign(next && /^\/(experience|job-postings)\/(create|me|[1-9]\d*)$/.test(next) ? next : "/experience/create");
      }
    } catch (error) {
      if (error.status === 401) showMessage("아이디 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.");
      else if (error.status === 409) {
        fieldError(loginId, "이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.");
        showMessage("이미 사용 중인 아이디입니다. 다른 아이디로 가입하거나 로그인해 주세요.");
      } else if (error.status === 422) {
        const fieldMap = { login_id: loginId, password, name: form.elements.name };
        if (Array.isArray(error.detail)) error.detail.forEach((item) => {
          const field = fieldMap[item.loc?.at(-1)];
          if (field) fieldError(field, "입력 조건을 확인해 주세요.");
        });
        showMessage("입력 정보를 확인해 주세요. 필수 항목과 글자 수 조건을 확인한 뒤 다시 시도해 주세요.");
      } else if (error.status === 429) showMessage("요청이 많아 잠시 기다려야 해요. 잠시 후 다시 시도해 주세요.");
      else if (error.name === "AbortError") showMessage(isRegister ? "응답이 지연되고 있어요. 가입이 완료되었을 수 있으니 로그인 화면에서 먼저 확인해 주세요." : "응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.");
      else if (error.status >= 500) showMessage("서버에서 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
      else showMessage("연결 상태를 확인해 주세요. 서버에 연결할 수 없거나 올바른 응답을 받지 못했어요.");
    } finally {
      setPending(false);
    }
  });

  const logout = document.getElementById("logout-button");
  logout?.addEventListener("click", async () => {
    if (logout.disabled) return;
    const logoutMessage = document.getElementById("logout-message");
    logout.disabled = true;
    logout.textContent = "로그아웃 중…";
    logoutMessage.hidden = true;
    try {
      await apiRequest("/api/auth/logout", {});
      success.hidden = true;
      entry.hidden = false;
      document.title = "로그인 · 자소서담";
      showMessage("로그아웃되었습니다.", true);
    } catch {
      logoutMessage.textContent = "로그아웃하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.";
      logoutMessage.hidden = false;
    } finally {
      logout.disabled = false;
      logout.textContent = "로그아웃";
    }
  });

  // A restored browser history page is not proof that a server session is valid.
  window.addEventListener("pageshow", (event) => { if (event.persisted) window.location.reload(); });
}
