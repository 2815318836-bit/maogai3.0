const CONFIG = {
  "单选题": 20,
  "多选题": 10,
  "判断题": 20,
};

const TYPE_TITLES = {
  "单选题": "单选题",
  "多选题": "多选题",
  "判断题": "判断题",
};

const state = {
  paper: [],
  answers: new Map(),
  submitted: false,
};

const paperEl = document.querySelector("#paper");
const answeredCountEl = document.querySelector("#answeredCount");
const scoreTextEl = document.querySelector("#scoreText");
const submitBtn = document.querySelector("#submitBtn");
const newPaperBtn = document.querySelector("#newPaperBtn");
const resultPanel = document.querySelector("#resultPanel");
const resultTitle = document.querySelector("#resultTitle");
const resultSummary = document.querySelector("#resultSummary");
const progressBar = document.querySelector("#progressBar");

function normalizeAnswer(answer) {
  return String(answer || "")
    .toUpperCase()
    .match(/[A-F]/g)?.join("") || "";
}

function answerSet(answer) {
  return new Set(normalizeAnswer(answer).split("").filter(Boolean));
}

function optionList(question) {
  return ["A", "B", "C", "D", "E", "F"]
    .map((letter) => ({ letter, text: question[`option${letter}`] || "" }))
    .filter((item) => item.text);
}

function randomPick(items, count) {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function buildPaper() {
  const bank = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];
  const selected = [];

  for (const [type, count] of Object.entries(CONFIG)) {
    const items = bank.filter((item) => item.type === type);
    if (items.length < count) {
      throw new Error(`${type} 数量不足：需要 ${count}，当前 ${items.length}`);
    }
    selected.push(...randomPick(items, count).map((item) => ({ ...item, type })));
  }

  state.paper = selected.map((item, index) => ({
    ...item,
    id: `q${index + 1}`,
    displayIndex: index + 1,
    correctAnswer: normalizeAnswer(item.correctAnswer),
  }));
  state.answers = new Map();
  state.submitted = false;
  document.body.classList.remove("submitted");
  resultPanel.hidden = true;
  submitBtn.disabled = false;
  scoreTextEl.textContent = "--";
  renderPaper();
  updateAnsweredCount();
}

function renderPaper() {
  paperEl.innerHTML = "";
  let cursor = 0;

  for (const [type, count] of Object.entries(CONFIG)) {
    const section = document.createElement("section");
    section.className = "paper-section";

    const heading = document.createElement("div");
    heading.className = "section-title";
    heading.innerHTML = `<h2>${TYPE_TITLES[type]}</h2><span>${count} 题</span>`;
    section.appendChild(heading);

    const questions = state.paper.slice(cursor, cursor + count);
    cursor += count;
    for (const question of questions) section.appendChild(renderQuestion(question));
    paperEl.appendChild(section);
  }
}

function renderQuestion(question) {
  const card = document.createElement("article");
  card.className = "question-card";
  card.dataset.id = question.id;

  const options = optionList(question);
  const inputType = question.type === "多选题" ? "checkbox" : "radio";

  const optionsHtml = options.map((option) => {
    return `
      <label class="option" data-letter="${option.letter}">
        <input type="${inputType}" name="${question.id}" value="${option.letter}">
        <span><span class="letter">${option.letter}</span><span class="option-text">${escapeHtml(option.text)}</span></span>
      </label>
    `;
  }).join("");

  card.innerHTML = `
    <div class="question-head">
      <div class="q-number">${question.displayIndex}.</div>
      <div class="q-title">${escapeHtml(question.question)}</div>
    </div>
    <div class="options">${optionsHtml}</div>
    <div class="analysis"></div>
  `;

  card.addEventListener("change", () => {
    const selected = Array.from(card.querySelectorAll("input:checked")).map((input) => input.value).sort().join("");
    if (selected) state.answers.set(question.id, selected);
    else state.answers.delete(question.id);
    updateAnsweredCount();
  });

  return card;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateAnsweredCount() {
  answeredCountEl.textContent = `${state.answers.size}/50`;
  if (progressBar) progressBar.style.width = `${(state.answers.size / 50) * 100}%`;
}

function answersEqual(userAnswer, correctAnswer) {
  const user = answerSet(userAnswer);
  const correct = answerSet(correctAnswer);
  if (user.size !== correct.size) return false;
  for (const item of user) {
    if (!correct.has(item)) return false;
  }
  return true;
}

function answerText(question, letters) {
  const options = Object.fromEntries(optionList(question).map((item) => [item.letter, item.text]));
  const normalized = normalizeAnswer(letters);
  if (!normalized) return "未答";
  return normalized.split("").map((letter) => `${letter}. ${options[letter] || ""}`).join("；");
}

function submitPaper() {
  if (state.submitted) return;
  state.submitted = true;
  document.body.classList.add("submitted");
  submitBtn.disabled = true;

  let score = 0;
  const wrongItems = [];

  for (const question of state.paper) {
    const userAnswer = state.answers.get(question.id) || "";
    const ok = answersEqual(userAnswer, question.correctAnswer);
    if (ok) score += 1;
    else wrongItems.push(question);
    paintQuestion(question, userAnswer, ok);
  }

  scoreTextEl.textContent = `${score}/50`;
  resultTitle.textContent = `${score} / 50`;
  resultSummary.textContent = `错题 ${wrongItems.length} 道，未答 ${50 - state.answers.size} 道`;
  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function paintQuestion(question, userAnswer, ok) {
  const card = paperEl.querySelector(`[data-id="${question.id}"]`);
  if (!card) return;
  card.classList.add(ok ? "correct" : "wrong");

  const correctLetters = answerSet(question.correctAnswer);
  const userLetters = answerSet(userAnswer);
  for (const option of card.querySelectorAll(".option")) {
    const letter = option.dataset.letter;
    if (correctLetters.has(letter)) option.classList.add("answer-right");
    if (!correctLetters.has(letter) && userLetters.has(letter)) option.classList.add("answer-wrong");
    option.querySelector("input").disabled = true;
  }

  const analysis = card.querySelector(".analysis");
  analysis.classList.add(ok ? "good" : "bad");
  analysis.innerHTML = `
    <div class="analysis-grid">
      <div><span>结果</span><strong>${ok ? "正确" : "错误"}</strong></div>
      <div><span>你的答案</span><strong>${escapeHtml(answerText(question, userAnswer))}</strong></div>
      <div><span>正确答案</span><strong>${escapeHtml(answerText(question, question.correctAnswer))}</strong></div>
    </div>
    <p class="analysis-text">${escapeHtml(question.analysis || "无解析")}</p>
  `;
}

submitBtn.addEventListener("click", submitPaper);
newPaperBtn.addEventListener("click", buildPaper);

try {
  buildPaper();
} catch (error) {
  paperEl.innerHTML = `<section class="question-card"><div class="question-head"><div class="q-number">!</div><div class="q-title">${escapeHtml(error.message)}</div></div></section>`;
  submitBtn.disabled = true;
}
