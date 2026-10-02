"""Define relevant paths to games, logic engine and optimization."""

import os
from pathlib import Path

PROJECT_PATH = os.path.abspath(Path(__file__).resolve().parent.parent.parent)
PATH_TO_ENGINE = PROJECT_PATH
PATH_TO_GAMES = os.path.join(PROJECT_PATH, "games")
OPTIMIZATION_PATH = os.path.join(PROJECT_PATH, "optimization_program")
SETUP_PATH = os.path.join(OPTIMIZATION_PATH, "src", "setup.toml")


def library_dirname() -> str:
    """
    The folder under games/<id>/ that this run reads and writes.

    "library" unless MATH_LIBRARY_DIR says otherwise. A test or profiling run
    points it somewhere else so it cannot touch the build on disk - a half
    finished run inside library/ is indistinguishable from a finished one, and
    the finished one is 40 minutes and ~3.3 GB.

    Read on every call rather than captured at import, so a caller can set the
    variable in its own __main__ before it constructs the config.
    """
    return os.environ.get("MATH_LIBRARY_DIR") or "library"
