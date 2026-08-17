# Production release checklist

## Automated release gate

- [ ] `npm ci`
- [ ] `npm audit` reports zero known vulnerabilities
- [ ] `npm test`
- [ ] Built-output checks confirm relative assets, no source maps, no machine-local paths,
      no QA manifests and no internal OCR/crop metadata
- [ ] Desktop and 320/390 px browser smoke tests have no console/page errors or horizontal overflow

## Installable-application and offline gate

- [ ] The production origin is HTTPS; a service worker will not register without it
- [ ] A first visit registers the worker, and a second visit loads with the network disabled
- [ ] Installing to the home screen on Android and iPad opens standalone with the right icon
- [ ] The offline question-library download completes, reports its size, and survives a reload
- [ ] A paper can be sat, submitted and reviewed end to end with the network disabled, and
      the results appear in the account once the connection returns
- [ ] Deploying a new build offers the update banner rather than reloading mid-session, and
      the previous shell cache is removed once it is applied
- [ ] Writing done on a question offline syncs on reconnection and is readable in the review
- [ ] Stylus, finger and mouse each write; a resting palm does not; a finger moves the
      question once a stylus has been used, including after moving to the next question
- [ ] A pen's eraser end and barrel button rub out without changing the selected tool
- [ ] Consecutive stylus strokes all write, and none of them scrolls the question
- [ ] Two fingers pinch to magnify, and leave no mark where one had begun a stroke
- [ ] The Move tool drags the question with a mouse, a stylus and a finger, and the page
      travels exactly as far as the pointer does
- [ ] The option cut line lands where the printed options actually begin on each paper, and
      the crop returns in full when it is switched off

## Firebase gate

- [ ] Production hostname is authorised for Google sign-in
- [ ] Google provider is enabled and popup/redirect fallback works on desktop and mobile
- [ ] Current `firestore.rules` are deployed to the configured project, including the
      `scratchpads` collection added for writing on questions
- [ ] Two-account shared-browser test proves local state is UID-scoped
- [ ] Cross-device active-session recovery, completion sync, export, cloud deletion and
      account deletion are tested against production Firebase
- [ ] Error/usage monitoring and an incident contact are selected by the operator

## Content and accessibility gate

- [ ] Written redistribution permission or qualified legal clearance is recorded for
      every historic question/solution source
- [ ] Every answer-key-only item has an item-specific, independently checked derivation;
      generic topic examples are not represented as worked solutions to that item
- [ ] Every historic question and official solution has a reviewed accessible transcript
- [ ] The writing layer is pointer-only by nature; its tools, the option cut line and
      every other control around it are reachable and operable from the keyboard
- [ ] Keyboard-only, screen-reader, zoom and contrast checks pass on authenticated flows

## Operator gate

- [ ] `PRIVACY.md` contains the real controller/operator name and contact
- [ ] `TERMS.md` is reviewed for the intended jurisdiction and business model
- [ ] Retention, support, backup/recovery and service-withdrawal procedures are documented
- [ ] Branch protection requires the `verify` workflow before merging to `main`

Do not describe the site as fully production-ready while any launch-gate item remains open.
