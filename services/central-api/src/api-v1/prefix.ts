/**
 * The URL prefix every `/api/v1` route hangs off, as Nest wants it.
 *
 * No leading slash: `@Controller` composes its argument with the handler's own
 * segment, and the two forms are not the same string. `cors.ts` needs the
 * leading-slash form to match an incoming URL and builds it with a template, so
 * there is one definition here and one derived use there rather than two
 * spellings of the prefix in one service.
 *
 * The browser's copy of this prefix lives in `consolePath` in
 * `@hewa/console-types`, which this package depends on and so could import — and
 * does not, because `consolePath` returns a *path* (`/api/v1/alerts`, with a
 * leading slash and the view's name on it) and this is a prefix. Sharing it would
 * mean calling `consolePath` for a value that is not a view, and stripping the
 * view back off the result. The e2e test is what holds the two together: it
 * asserts each controller's route answers at the path the contract builds.
 */
export const API_V1_PREFIX = "api/v1";
