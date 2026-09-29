# The Wall

A digital contemporary art installation where users can leave temporary graffiti messages on a virtual concrete wall. The project was built as a final project for the Coders Lab React course.

## Concept

The Wall is an interactive digital art piece. Only one graffiti message exists on the wall at a time. Visitors can overwrite the current message with their own, becoming the next creator. The old message is archived in the **Graveyard** for posterity.

## Technologies

- **React** – components, props, state (`useState`), effects (`useEffect`), and events
- **Fetch API** – communication between the React application and json-server
- **Vite** – fast build tool and development server
- **Sass (SCSS)** – modular styles with variables and mixins
- **json-server** – mock REST API for data persistence
- **ESLint + Prettier** – code quality and formatting

## Setup and Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/YuriyIzbash/The-Wall.git
   cd The-Wall
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the `json-server` in a **separate terminal**:

   ```bash
   npm run server
   ```

   `json-server` runs on `http://localhost:5001`.

4. Start the React development server:

   ```bash
   npm start
   ```

   Vite runs on `http://localhost:5173`.

5. Open the browser and visit:

   `http://localhost:5173`

## Features

- Full-screen wall with responsive concrete background
- Graffiti messages with random fonts and colors
- Overwrite flow with modal form (message, author, anonymous toggle)
- Graveyard archive with pagination
- Hall of Fame (top messages by survival time)
- Message of the Week (longest survival in the last 7 days)
- Info modals: Rules, Privacy Policy, Terms of Use
- Fully responsive design for mobile, tablet, and desktop

## Production backend (Worker + D1)

The React application and `json-server` mock backend remain unchanged in this phase. The new Worker is an independently testable API under `worker/`; the frontend does not call it yet.

### One-time Cloudflare configuration

1. In [`wrangler.jsonc`](./wrangler.jsonc), replace `REPLACE_WITH_THE_EXISTING_WORKER_NAME`, `REPLACE_WITH_THE_EXISTING_D1_DATABASE_NAME`, and `REPLACE_WITH_THE_EXISTING_D1_DATABASE_ID` with the existing Cloudflare resource values. This preserves the required `DB` binding; it does not create another Worker or D1 database.
2. Replace `REPLACE_WITH_THE_VERIFIED_USDT_TRC20_CONTRACT_ADDRESS` with the USDT TRC-20 contract address already verified for this project.
3. Copy [`worker/.dev.vars.example`](./worker/.dev.vars.example) to `worker/.dev.vars` for local work and set `TRONSCAN_API_KEY`. Do not commit that file.
4. Add the production secret with `npx wrangler secret put TRONSCAN_API_KEY`.

Required public variables are `TRONSCAN_API_URL`, `WALL_RECEIVING_ADDRESS`, `USDT_CONTRACT_ADDRESS`, `PAYMENT_EXPIRATION_MINUTES`, and `FRONTEND_ORIGIN`. `TRONSCAN_API_KEY` is the only required secret and is never returned by the API.

Apply the schema to the existing D1 database (replace the placeholder with its real name):

```bash
npx wrangler d1 execute <existing-d1-name> --remote --file migrations/0001_initial_schema.sql
```

For local Worker development, first configure a local D1 binding or use the existing remote binding as appropriate, then run:

```bash
npm run worker:dev
```

Other backend commands:

```bash
npm run worker:typecheck
npm run worker:test
npm run worker:deploy
```

### Worker API

All responses use either `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code", "message" } }`.

```bash
# Health and read-only endpoints
curl http://localhost:8787/api/health
curl http://localhost:8787/api/wall
curl http://localhost:8787/api/graveyard
curl http://localhost:8787/api/hall-of-fame
curl http://localhost:8787/api/message-of-the-week

# Create a pending payment and message (the wall does not change yet)
curl -X POST http://localhost:8787/api/overwrites \
  -H 'Content-Type: application/json' \
  -d '{"message":"A new mark","author":"Artist","isAnonymous":false}'

# Look up its payment status
curl http://localhost:8787/api/payments/<payment-id>

# Verify a real TRON transaction only after it has been broadcast
curl -X POST http://localhost:8787/api/payments/<payment-id>/verify \
  -H 'Content-Type: application/json' \
  -d '{"transactionHash":"<64-character-tron-transaction-hash>"}'
```

`POST /api/payments/:paymentId/verify` fetches and validates the transaction from TRONSCAN. It checks TRON success, USDT token and configured contract, recipient, a minimum of 1,000,000 USDT base units (1 USDT), expiry, pending state, and transaction uniqueness. Confirmation changes the payment and the active message in one D1 batch; a partial unique index enforces a maximum of one active message.

## Project Structure

```text
The-Wall/
├── db.json                 # json-server database
├── package.json            # Project configuration and scripts
├── README.md
└── src/
    ├── components/        # Reusable UI components
    ├── styles/            # SCSS partials
    ├── utils/             # Helper functions
    ├── assets/            # Images and fonts
    ├── App.jsx            # Main application component
    └── main.jsx           # Entry point
```

## License

This project is for educational purposes as part of the Coders Lab course.

## Author

**Yuriy Izbash**
