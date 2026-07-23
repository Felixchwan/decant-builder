# Analytics Foundation

The Builder exposes a provider-neutral analytics interface:

```js
analytics.track(eventName, payload)
```

Events are defined centrally in `events.js`. Payloads are allowlisted per event and guarded against personal fields before any provider receives them.

## Privacy Rules

Never add customer name, city, notes, phone numbers, WhatsApp message bodies, raw search text, URLs with user data, or raw error stacks to analytics payloads. Search is represented only by derived metadata such as query length and result count.

## Debugging

Set `VITE_ANALYTICS_DEBUG=true` in development to print compact events through the centralized development observer. Debug events are not persisted and no network requests are made.

## Future Providers

A future provider should implement `{ track(eventName, payload) }` and be injected from the app composition layer. Providers must not import merchant implementations or Composer Core.
