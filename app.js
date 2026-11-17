(function () {
  const NEXT_DELAY = 800;

  const quizScreen   = document.getElementById("quiz-screen");
  const resultScreen = document.getElementById("result-screen");
  const progressText = document.getElementById("progress-text");
  const scoreLive    = document.getElementById("score-live");
  const timerText    = document.getElementById("timer");
  const timeFill     = document.getElementById("time-fill");
  const barWrap      = document.querySelector(".bar");
  const barFill      = document.getElementById("bar-fill");
  const questionText = document.getElementById("question-text");
  const answersBox   = document.getElementById("answers");
  const finalScore   = document.getElementById("final-score");
  const finalTotal   = document.getElementById("final-total");
  const resultMsg    = document.getElementById("result-message");
  const reviewList   = document.getElementById("review");
  const retryBtn     = document.getElementById("retry-btn");

  let current = 0;
  let score = 0;
  let picks = [];
  let locked = false;
  let timeLeft = 0;
  let timerId = null;

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
    timeFill.style.width = (timeLeft / SECONDS_PER_QUESTION) * 100 + "%";
  }

  function startTimer() {
    stopTimer();
    timeLeft = SECONDS_PER_QUESTION;
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

  function start() {
    current = 0;
    score = 0;
    picks = [];
    locked = false;
    resultScreen.hidden = true;
    quizScreen.hidden = false;
    showQuestion();
  }

  function showQuestion() {
    const q = QUESTIONS[current];
    const total = QUESTIONS.length;

    progressText.textContent = "Question " + (current + 1) + " of " + total;
    scoreLive.textContent = "Score: " + score;
    const pct = Math.round((current / total) * 100);
    barFill.style.width = pct + "%";
    barWrap.setAttribute("aria-valuenow", pct);

    questionText.textContent = q.question;
    answersBox.innerHTML = "";

    q.choices.forEach(function (text, i) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "answer";
      btn.textContent = text;
      btn.addEventListener("click", function () { choose(i, btn); });
      answersBox.appendChild(btn);
    });
    locked = false;
    startTimer();
  }

  function goNext() {
    setTimeout(function () {
      current++;
      if (current < QUESTIONS.length) showQuestion();
      else showResult();
    }, NEXT_DELAY);
  }

  function choose(index, btn) {
    if (locked) return;
    locked = true;
    stopTimer();

    const q = QUESTIONS[current];
    picks.push(index);

    const buttons = answersBox.querySelectorAll(".answer");
    buttons.forEach(function (b) { b.disabled = true; });
    buttons[q.answer].classList.add("correct");

    if (index === q.answer) {
      score++;
    } else {
      btn.classList.add("wrong");
    }
    scoreLive.textContent = "Score: " + score;
    goNext();
  }

  function timeUp() {
    if (locked) return;
    locked = true;

    const q = QUESTIONS[current];
    picks.push(-1);

    const buttons = answersBox.querySelectorAll(".answer");
    buttons.forEach(function (b) { b.disabled = true; });
    buttons[q.answer].classList.add("correct");
    goNext();
  }

  function showResult() {
    stopTimer();
    const total = QUESTIONS.length;
    quizScreen.hidden = true;
    resultScreen.hidden = false;

    finalScore.textContent = score;
    finalTotal.textContent = total;

    const ratio = score / total;
    resultMsg.textContent =
      ratio === 1  ? "Perfect score. Great work!" :
      ratio >= 0.6 ? "Good job. Review the missed questions below." :
                     "Keep practicing. Check the answers below and try again.";

    reviewList.innerHTML = "";
    QUESTIONS.forEach(function (q, i) {
      const li = document.createElement("li");
      const right = picks[i] === q.answer;
      const timedOut = picks[i] === -1;

      const status = document.createElement("span");
      status.className = right ? "ok" : (timedOut ? "late" : "no");
      status.textContent = right ? "Correct: " : (timedOut ? "Time's up: " : "Wrong: ");
      li.appendChild(status);
      li.appendChild(document.createTextNode(q.question));

      if (!right) {
        const hint = document.createElement("span");
        hint.className = "right-answer";
        hint.textContent = "Right answer: " + q.choices[q.answer];
        li.appendChild(hint);
      }
      reviewList.appendChild(li);
    });
    retryBtn.focus();
  }

  retryBtn.addEventListener("click", start);
  start();
})();
