---
"@hewa/console-types": minor
---

Group the `streams` view by channel, and drop its YouTube field.

- `StreamChannel` is the channel vocabulary, `Stream.channel` is typed as it,
  and `ConsolePayload["streams"]` carries it in `meta.groups` like the other six
  grouped views. The view was the odd one out: it sent an empty vocabulary, so
  its summary bar could not act on anything, and the rail beside it filtered on
  channel names that existed only in the browser.
- `Stream.videoId` is gone. It existed for an `<iframe>` in the admin dashboard
  that embedded a third party's player, and the id travelled through the service
  to reach it. Nothing reads it now, and a published field is a promise to carry.
