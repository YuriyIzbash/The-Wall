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

## Contribution setup

The Wall invites visitors to make a voluntary contribution of 1 USDT or more.
It does not verify or monitor contributions. Selecting a network and continuing
publishes the overwrite.

Set these public Worker variables in `wrangler.jsonc` (or the Cloudflare Workers
dashboard) with the receiving address for each network:

```text
PAYMENT_BSC_ADDRESS
PAYMENT_ETHEREUM_ADDRESS
PAYMENT_TRON_ADDRESS
PAYMENT_POLYGON_ADDRESS
PAYMENT_SOLANA_ADDRESS
PAYMENT_TON_ADDRESS
```

For local development, put the same values in `worker/.dev.vars`:

```text
PAYMENT_BSC_ADDRESS=your-bsc-address
PAYMENT_ETHEREUM_ADDRESS=your-ethereum-address
PAYMENT_TRON_ADDRESS=your-tron-address
PAYMENT_POLYGON_ADDRESS=your-polygon-address
PAYMENT_SOLANA_ADDRESS=your-solana-address
PAYMENT_TON_ADDRESS=your-ton-address
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
