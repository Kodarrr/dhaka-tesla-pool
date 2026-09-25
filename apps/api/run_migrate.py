import pty
import os
import sys

def read_and_answer(fd):
    output = b""
    while True:
        try:
            data = os.read(fd, 1024)
            if not data:
                break
            output += data
            # Print so we can see what's happening
            sys.stdout.write(data.decode("utf-8", errors="replace"))
            sys.stdout.flush()
            if b"Are you sure you want create and apply this migration?" in data or b"y/N" in data or b"Yes" in data:
                os.write(fd, b"y\n")
        except OSError:
            break
    return output

pty.spawn(["npx", "prisma", "migrate", "dev", "--name", "add_review_remove_started", "--skip-seed"], read_and_answer)
