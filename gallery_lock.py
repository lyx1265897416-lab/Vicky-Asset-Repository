"""Serialize gallery publications while allowing isolated asset creation in parallel."""
import fcntl
import os
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def gallery_lock(root):
    if os.environ.get('VICKY_GALLERY_LOCK_PARENT') == str(os.getppid()):
        yield
        return
    with (Path(root)/'.gallery-publish.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def acquire_for_process(root):
    import atexit
    context = gallery_lock(root)
    context.__enter__()
    atexit.register(context.__exit__, None, None, None)
    return context
