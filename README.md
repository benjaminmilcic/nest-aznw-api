# NestAznwApi

This is the backend code for my personal homepage.

<p align="center">
  <strong>Visit my homepage here:</strong><br><br>
  <a href="https://benjamin-milcic.dev/" target="_blank">
    <img src="https://benjamin-milcic.dev/assets/homepage-image.png" width="300" alt="benjamin-milcic.dev" />
  </a>
  <br>
  <a href="https://benjamin-milcic.dev/" target="_blank">https://benjamin-milcic.dev</a>
</p>

This backend is made with NestJS.

The repository is public, because I made this website to demonstrate my skills.
The frontend that is used by this backend can be viewed here: [Frontend repository for this backend](https://github.com/benjaminmilcic/aznw-routes). It is also public.

If you have any hints or questions feel free to write me an email to [benjamin.milcic@gmail.com](mailto:benjamin.milcic@gmail.com).

## AI chat

The AI chat of the website (`src/chat`) keeps the conversation history per session in memory and forwards every
question to the Python service [python-aznw-api](https://github.com/benjaminmilcic/python-aznw-api), which runs RAG and
tool calling with the language model. Related modules: `availability` (shown in the website header and used by the
chat) and `jokes` (random joke for the chat, internal only).

| Endpoint | Purpose |
|---|---|
| `POST /chat/stream` | `{sessionId, message, location?}` → answer as Server-Sent Events (max. 5 questions per minute per visitor) |
| `DELETE /chat/:sessionId` | start a new chat |
| `POST /chat/transcribe` | speech input (multipart `audio`, `quality`) |
| `GET /availability` | `{available, year, quarter}` |
| `GET /jokes/random?lang=de\|en\|hr` | only with header `x-internal-api-key` |
| `GET /health` | `{status, build}` – the deploy workflow waits until `build` is the pushed commit |

Environment variables:

| Variable | Meaning |
|---|---|
| `PYTHON_API_URL` | address of python-aznw-api, default `http://127.0.0.1:8000` |
| `INTERNAL_API_KEY` | shared secret with python-aznw-api (same value there) |

Developing the chat locally without the MySQL database: `npm run start:chat-dev` starts only the chat-related
modules on port 3000.


<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

