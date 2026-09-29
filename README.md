# The Wall

A digital contemporary art installation where users can leave temporary graffiti messages on a virtual concrete wall. The project was built as a final project for the Coders Lab React course.

## Concept

The Wall is an interactive digital art piece. Only one graffiti message exists on the wall at a time. Visitors can overwrite the current message with their own, becoming the next creator. The old message is archived in the **Graveyard** for posterity.

## Features

- Full-screen wall with responsive concrete background
- Graffiti messages with random fonts and colors
- Overwrite flow with modal form (message, author, anonymous toggle)
- Graveyard archive with pagination
- Hall of Fame (top messages by survival time)
- Message of the Week (longest survival in the last 7 days)
- Info modals: Rules, Privacy Policy, Terms of Use
- Fully responsive design for mobile, tablet, and desktop

## Payment setup

Overwrites are paid with exactly 1 USDT on TRON. The Worker verifies a submitted
transaction hash with TRONSCAN before it publishes the pending message.

Set the following Worker secret before deploying:

```sh
npx wrangler secret put TRONSCAN_API_KEY
```

The public Worker configuration in `wrangler.jsonc` supplies the receiving address,
USDT contract, payment expiry, and allowed frontend origin. Change those values there
when deploying a different environment; do not put the TRONSCAN API key in the frontend.

For local development, put the same key in `worker/.dev.vars`:

```text
TRONSCAN_API_KEY=your-tronscan-api-key
```

Run the app and Worker in separate terminals:

```sh
npm run worker:dev
npm run dev
```

Deploy with:

```sh
npm run worker:deploy
```

## Author

**Yuriy Izbash**
