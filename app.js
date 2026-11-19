(function () {
  // For local development, run the backend on this computer at port 3000.
  // Replace this value with the deployed backend origin before publishing the frontend.
  const API_BASE_URL = "https://quiz-backend-nu-six.vercel.app";
  const DEFAULT_SECONDS_PER_QUESTION = 60;
  const NEXT_DELAY = 800;

  const selectionScreen = document.getElementById("selection-screen");
  const examButtons = document.getElementById("exam-buttons");
  const quizScreen = document.getElementById("quiz-screen");
  const resultScreen = document.getElementById("result-screen");
  const progressText = document.getElementById("progress-text");
  const scoreLive = document.getElementById("score-live");
  const timerText = document.getElementById("timer");
  const timeFill = document.getElementById("time-fill");
  const barWrap = document.querySelector(".bar");
  const barFill = document.getElementById("bar-fill");
  const questionText = document.getElementById("question-text");
  const answersBox = document.getElementById("answers");
  const finalScore = document.getElementById("final-score");
  const finalTotal = document.getElementById("final-total");
  const resultMsg = document.getElementById("result-message");
  const reviewList = document.getElementById("review");
  const retryBtn = document.getElementById("retry-btn");
  const homeBtn = document.getElementById("home-btn");

  function createStatus(parent, beforeElement) {
    const status = document.createElement("p");
    status.className = "api-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    parent.insertBefore(status, beforeElement);
    return status;
  }

  const selectionStatus = createStatus(selectionScreen, examButtons);
  const quizStatus = createStatus(quizScreen, questionText);

  let quizzes = [];
  let selectedQuiz = null;
  let quizQuestions = [];
  let current = 0;
  let score = 0;
  let picks = [];
  let locked = false;
  let timeLeft = 0;
  let currentQuestionSeconds = DEFAULT_SECONDS_PER_QUESTION;
  let timerId = null;

  function setStatus(element, message, isError) {
    element.textContent = message || "";
    element.classList.toggle("error", Boolean(isError));
    element.hidden = !message;
  }

  async function requestJson(path, options) {
    const response = await fetch(API_BASE_URL + path, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options && options.body ? { "Content-Type": "application/json" } : {}),
        ...((options && options.headers) || {})
      }
    });

    const responseText = await response.text();
    let data = responseText;
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch (_) {
        // Keep plain-text responses so the answer-check response can be read too.
      }
    }

    if (!response.ok) {
      const message = data && typeof data === "object"
        ? (data.message || data.error)
        : data;
      throw new Error(message || `Request failed (HTTP ${response.status})`);
    }
    return data;
  }

  function arrayFromResponse(data, property) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return null;
    if (Array.isArray(data[property])) return data[property];
    if (Array.isArray(data.data)) return data.data;
    if (data.data && Array.isArray(data.data[property])) return data.data[property];
    if (Array.isArray(data.results)) return data.results;
    return null;
  }

  function normalizeQuiz(raw) {
    const id = raw.id ?? raw.quizId ?? raw._id ?? raw.slug;
    const title = raw.title ?? raw.name ?? raw.quizName ?? raw.label;
    if (id === undefined || id === null) {
      throw new Error("A quiz returned by the API is missing its id.");
    }
    return { id: String(id), title: String(title || `Quiz ${id}`) };
  }

  function normalizeOption(option) {
    if (option && typeof option === "object") {
      const label = option.text ?? option.label ?? option.answer ?? option.value;
      const value = option.value ?? option.text ?? option.label ?? option.answer;
      return { label: String(label ?? ""), value: String(value ?? "") };
    }
    return { label: String(option), value: String(option) };
  }

  function normalizeQuestion(raw) {
    const id = raw.id ?? raw.questionId ?? raw._id;
    const question = raw.question ?? raw.questionText ?? raw.text ?? raw.title;
    const rawOptions = raw.options ?? raw.choices ?? raw.answers;
    if (id === undefined || id === null) {
      throw new Error("A question returned by the API is missing its id.");
    }
    if (!question || !Array.isArray(rawOptions) || rawOptions.length === 0) {
      throw new Error("A question must include text and an options array.");
    }
    return {
      id: String(id),
      question: String(question),
      options: rawOptions.map(normalizeOption),
      timeLimit: Number(raw.timeLimit ?? raw.seconds ?? DEFAULT_SECONDS_PER_QUESTION)
    };
  }

  async function loadQuizzes() {
    examButtons.innerHTML = "";
    const loading = document.createElement("p");
    loading.textContent = "Loading quizzes...";
    examButtons.appendChild(loading);
    setStatus(selectionStatus, "", false);

    try {
      const data = await requestJson("/api/retrieve/quizzes");
      const list = arrayFromResponse(data, "quizzes");
      if (!list || list.length === 0) {
        throw new Error("The quizzes API returned no quizzes.");
      }
      quizzes = list.map(normalizeQuiz);
      renderQuizButtons();
    } catch (error) {
      examButtons.innerHTML = "";
      setStatus(selectionStatus, `Could not load quizzes: ${error.message}`, true);
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "exam-button";
      retry.textContent = "Try loading quizzes again";
      retry.addEventListener("click", loadQuizzes);
      examButtons.appendChild(retry);
    }
  }

  function renderQuizButtons() {
    examButtons.innerHTML = "";
    quizzes.forEach(function (quiz) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "exam-button";
      button.textContent = quiz.title;
      button.addEventListener("click", function () {
        loadQuizQuestions(quiz, button);
      });
      examButtons.appendChild(button);
    });
  }

  async function loadQuizQuestions(quiz, selectedButton) {
    examButtons.querySelectorAll("button").forEach(function (button) {
      button.disabled = true;
    });
    setStatus(selectionStatus, "Loading questions...", false);

    try {
      const path = `/api/${encodeURIComponent(quiz.id)}/questions`;
      const data = await requestJson(path);
      const list = arrayFromResponse(data, "questions");
      if (!list || list.length === 0) {
        throw new Error("The questions API returned no questions for this quiz.");
      }
      selectedQuiz = quiz;
      quizQuestions = list.map(normalizeQuestion);
      setStatus(selectionStatus, "", false);
      start();
    } catch (error) {
      setStatus(selectionStatus, `Could not load questions: ${error.message}`, true);
      examButtons.querySelectorAll("button").forEach(function (button) {
        button.disabled = false;
      });
      if (selectedButton) selectedButton.focus();
    }
  }

  function formatTime(total) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function renderTimer() {
    timerText.textContent = formatTime(timeLeft);
    const low = timeLeft <= 10;
    timerText.classList.toggle("low", low);
    timeFill.classList.toggle("low", low);
    timeFill.style.width = (timeLeft / currentQuestionSeconds) * 100 + "%";
  }

  function startTimer() {
    stopTimer();
    const question = quizQuestions[current];
    currentQuestionSeconds = question.timeLimit > 0
      ? question.timeLimit
      : DEFAULT_SECONDS_PER_QUESTION;
    timeLeft = currentQuestionSeconds;
    timeFill.style.transition = "none";
    renderTimer();
    void timeFill.offsetWidth;
    timeFill.style.transition = "";

    timerId = setInterval(function () {
      timeLeft--;
      renderTimer();
      if (timeLeft <= 0) {
        stopTimer();
        timeUp();
      }
    }, 1000);
  }

  function showSelection() {
    stopTimer();
    selectionScreen.hidden = false;
    quizScreen.hidden = true;
    resultScreen.hidden = true;
    setStatus(quizStatus, "", false);
    renderQuizButtons();
  }

  function start() {
    current = 0;
    score = 0;
    picks = [];
    locked = false;
    selectionScreen.hidden = true;
    resultScreen.hidden = true;
    quizScreen.hidden = false;
    setStatus(quizStatus, "", false);
    showQuestion();
  }

  function showQuestion() {
    const question = quizQuestions[current];
    const total = quizQuestions.length;

    progressText.textContent = "Question " + (current + 1) + " of " + total;
    scoreLive.textContent = "Score: " + score;
    const pct = Math.round((current / total) * 100);
    barFill.style.width = pct + "%";
    barWrap.setAttribute("aria-valuenow", pct);

    questionText.textContent = question.question;
    answersBox.innerHTML = "";

    question.options.forEach(function (option, index) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer";
      button.textContent = option.label;
      button.addEventListener("click", function () {
        choose(option, button);
      });
      answersBox.appendChild(button);
    });
    locked = false;
    setStatus(quizStatus, "", false);
    startTimer();
  }

  function goNext() {
    setTimeout(function () {
      current++;
      if (current < quizQuestions.length) showQuestion();
      else showResult();
    }, NEXT_DELAY);
  }

  function answerResult(payload) {
    if (typeof payload === "boolean") return payload;
    if (typeof payload === "string") {
      const text = payload.toLowerCase();
      if (/\b(correct|right)\b/.test(text)) return true;
      if (/\b(incorrect|wrong)\b/.test(text)) return false;
      return null;
    }
    if (!payload || typeof payload !== "object") return null;

    for (const key of ["isCorrect", "correct", "is_correct", "isAnswerCorrect"]) {
      if (typeof payload[key] === "boolean") return payload[key];
    }
    for (const key of ["result", "status", "message", "answerStatus"]) {
      if (typeof payload[key] === "string") {
        const text = payload[key].toLowerCase();
        if (/\b(correct|right)\b/.test(text)) return true;
        if (/\b(incorrect|wrong)\b/.test(text)) return false;
      }
    }
    return null;
  }

  function answerKeyFrom(payload) {
    if (!payload || typeof payload !== "object") return null;
    const value = payload.correctAnswer ?? payload.correct_answer ?? payload.rightAnswer;
    if (value === undefined || value === null) return null;
    return typeof value === "object" ? (value.text ?? value.value ?? null) : String(value);
  }

  async function choose(option, button) {
    if (locked) return;
    locked = true;
    stopTimer();
    answersBox.querySelectorAll(".answer").forEach(function (answerButton) {
      answerButton.disabled = true;
    });
    setStatus(quizStatus, "Checking your answer...", false);

    const question = quizQuestions[current];
    try {
      const response = await requestJson(
        `/api/${encodeURIComponent(selectedQuiz.id)}/check-answer`,
        {
          method: "POST",
          body: JSON.stringify({
            questionId: question.id,
            selectedAnswer: option.value
          })
        }
      );
      const isCorrect = answerResult(response);
      if (isCorrect === null) {
        throw new Error("The check-answer API response did not clearly say correct or incorrect.");
      }

      picks.push({
        selectedAnswer: option.label,
        isCorrect,
        timedOut: false,
        correctAnswer: answerKeyFrom(response)
      });
      if (isCorrect) {
        score++;
        button.classList.add("correct");
      } else {
        button.classList.add("wrong");
      }
      scoreLive.textContent = "Score: " + score;
      setStatus(quizStatus, isCorrect ? "Correct!" : "Incorrect.", !isCorrect);
      goNext();
    } catch (error) {
      locked = false;
      answersBox.querySelectorAll(".answer").forEach(function (answerButton) {
        answerButton.disabled = false;
      });
      setStatus(quizStatus, `Could not check the answer: ${error.message}`, true);
      startTimer();
    }
  }

  function timeUp() {
    if (locked) return;
    locked = true;
    picks.push({ selectedAnswer: null, isCorrect: false, timedOut: true, correctAnswer: null });
    answersBox.querySelectorAll(".answer").forEach(function (button) {
      button.disabled = true;
    });
    setStatus(quizStatus, "Time's up.", true);
    goNext();
  }

  function showResult() {
    stopTimer();
    quizScreen.hidden = true;
    resultScreen.hidden = false;
    document.querySelector("#result-screen h1").textContent = selectedQuiz.title + " Result";

    finalScore.textContent = score;
    finalTotal.textContent = quizQuestions.length;

    const ratio = quizQuestions.length ? score / quizQuestions.length : 0;
    resultMsg.textContent =
      ratio === 1 ? "Perfect score. Great work!" :
      ratio >= 0.6 ? "Good job. Review the missed questions below." :
      "Keep practicing. Review your answers below and try again.";

    reviewList.innerHTML = "";
    quizQuestions.forEach(function (question, index) {
      const pick = picks[index] || { selectedAnswer: null, isCorrect: false, timedOut: true };
      const li = document.createElement("li");
      const status = document.createElement("span");
      status.className = pick.isCorrect ? "ok" : (pick.timedOut ? "late" : "no");
      status.textContent = pick.isCorrect ? "Correct: " : (pick.timedOut ? "Time's up: " : "Wrong: ");
      li.appendChild(status);
      li.appendChild(document.createTextNode(question.question));

      if (pick.selectedAnswer) {
        const selected = document.createElement("span");
        selected.className = "review-detail";
        selected.textContent = "Your answer: " + pick.selectedAnswer;
        li.appendChild(selected);
      }
      if (!pick.isCorrect && pick.correctAnswer) {
        const right = document.createElement("span");
        right.className = "right-answer";
        right.textContent = "Right answer: " + pick.correctAnswer;
        li.appendChild(right);
      }
      reviewList.appendChild(li);
    });
    retryBtn.focus();
  }

  retryBtn.addEventListener("click", start);
  homeBtn.addEventListener("click", showSelection);
  loadQuizzes();
})();
