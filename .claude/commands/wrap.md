---
description: Close the session properly — verify, then write memory.md
---

Wrap up this session. Do all of it, in order:

1. Run `git status` and tell me plainly if anything is uncommitted or unpushed.
2. For anything you changed this session, state what was actually verified
   (syntax check, deployment READY, database checked) and what was not. Do not
   describe something as done if you only wrote the code.
3. Update `memory.md`:
   - what was done, with commit SHAs
   - what is next
   - what is still unverified, and exactly what I need to click or send to verify it
   - anything I am blocked on (accounts, credentials, decisions)
4. If something went wrong this session, add it to `lessons.md` in the existing
   style: what happened, then the rule that prevents it next time.
5. Push both files.
6. Give me a 5-line summary in plain language. No jargon.
