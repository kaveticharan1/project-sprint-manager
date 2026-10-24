"""Development server with auto-reload.

    python -m scripts.dev

uvicorn's own ``--reload`` restarts its worker on Windows by broadcasting CTRL_C_EVENT to the
whole console, which also kills the npm/node wrappers that launched it. watchfiles stops the
server process directly instead, so reloading works the same on Windows, macOS and Linux.
"""

import uvicorn
from watchfiles import PythonFilter, run_process

HOST = "127.0.0.1"
PORT = 8000


def serve() -> None:
    uvicorn.run("app.main:app", host=HOST, port=PORT)


if __name__ == "__main__":
    print(f"API on http://{HOST}:{PORT} (docs at /docs); reloading on changes in ./app")
    run_process("app", target=serve, watch_filter=PythonFilter())
