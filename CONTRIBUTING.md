# Contributing

AI Qadam Video Kit is an [AI Qadam Build](https://build.aiqadam.org) project and follows
its [governance](https://github.com/aiqadam/build.aiqadam.org/blob/main/GOVERNANCE.md).

- Open an issue before a large change, so it can be discussed first.
- Sign off every commit with `git commit -s`. That is the
  [Developer Certificate of Origin](https://developercertificate.org/): you confirm you
  have the right to submit the change under the project's MIT license. You keep your
  copyright; there is no CLA.
- Code, docs and skills are in English. Keep `AGENTS.md` and `skills/` free of anything
  specific to one coding agent.
- After a change to the runtime, sync or rendering, render the examples
  (`node kit.mjs render tutun-lounge`, `node kit.mjs render kit-promo`,
  `node kit.mjs render ottoman-empire`) and look at their
  stills before opening the pull request; say in it what you watched and what you only measured.
- Media in examples must carry a license that allows it (see
  `skills/video-kit/references/media.md`); files that may not be redistributed go in
  `assets/sources.json`, not in the repository.
