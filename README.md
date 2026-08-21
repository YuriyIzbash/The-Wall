# The Wall

A digital contemporary art installation where users can leave temporary graffiti messages on a virtual concrete wall. The project was built as a final project for the Coders Lab React course.

## Concept

The Wall is an interactive digital art piece. Only one graffiti message exists on the wall at a time. Visitors can overwrite the current message with their own, becoming the next creator. The old message is archived in the **Graveyard** for posterity.

## Technologies

* **React** – UI components, state management, hooks
* **Vite** – fast build tool and development server
* **Sass (SCSS)** – modular styles with variables and mixins
* **json-server** – mock REST API for data persistence
* **ESLint + Prettier** – code quality and formatting

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

3. Start the `json-server` in a separate terminal:

   ```bash
   npm run server
   ```

   `json-server` runs on `http://localhost:5001`.

4. Start the React development server:

   ```bash
   npm run dev
   ```

   Vite runs on `http://localhost:5173`.

5. Open the browser and visit:

   `http://localhost:5173`

## Features

* Full-screen wall with responsive concrete background
* Graffiti messages with random fonts and colors
* Overwrite flow with modal form (message, author, anonymous toggle)
* Graveyard archive with pagination
* Hall of Fame (top messages by survival time)
* Message of the Week (longest survival in the last 7 days)
* Info modals: Rules, Privacy Policy, Terms of Use
* Fully responsive design for mobile, tablet, and desktop

## Project Structure

```text
src/
├── components/          # Reusable UI components
├── styles/              # SCSS partials (variables, mixins, reset)
├── utils/               # Helper functions (graffiti styles, duration formatting)
├── assets/              # Images and fonts
├── App.jsx              # Main application component
└── main.jsx             # Entry point
```

## License

This project is for educational purposes as part of the Coders Lab course.

## Author

**Yuriy Izbash**
