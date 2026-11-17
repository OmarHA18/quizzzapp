# Quiz App API Connection

The frontend now uses the backend API instead of the sample questions that were previously stored in `js/questions.js`.

## API calls used

- `GET http://localhost:3000/api/retrieve/quizzes` loads the quiz list.
- `GET http://localhost:3000/api/{quizId}/questions` loads the questions for the selected quiz.
- `POST http://localhost:3000/api/{quizId}/check-answer` checks the student's answer.

The POST request body is:

```json
{
  "questionId": "q1",
  "selectedAnswer": "HTML"
}
```

The answer-check response should indicate whether the answer is correct or incorrect. The frontend accepts a boolean response or common JSON fields such as `isCorrect`, `correct`, `status`, `result`, or `message`.

## Before running

1. Start the backend on the same computer at `http://localhost:3000`.
2. Serve the frontend through a local web server, such as VS Code Live Server. Do not open `index.html` directly as a `file://` URL.
3. Make sure the backend allows the local frontend origin through CORS.
4. For deployment, change `API_BASE_URL` near the top of `js/app.js` from `http://localhost:3000` to the deployed backend origin, then configure backend CORS for the deployed frontend domain.
