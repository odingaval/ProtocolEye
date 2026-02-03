# Gemini Multimodal Audit Agent

An agent that acts as a bridge between visual reality (video/images) and technical documentation (PDFs/Manuals) to detect contradictions and audit procedures.

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Gemini API Key (get one at https://aistudio.google.com/app/apikey)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API Key:**
   
   Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and add your API key:
   ```
   API_KEY=your_gemini_api_key_here
   ```

   Or export as environment variable:
   ```bash
   export API_KEY=your_gemini_api_key_here
   ```

## Development

Start the development server:
```bash
npm start
```

The app will be available at `http://localhost:4200`

## Production Build

Build for production:
```bash
npm run build
```

The built files will be in `dist/gemini-multimodal-audit-agent/browser/`

## Usage

1. **Provide SOP**: Paste the Standard Operating Procedure (SOP) text directly or upload a text file (.txt, .md) in the left panel.
2. **Upload Evidence**: Upload an image or video frame showing the procedure being performed.
3. **Audit**: Click "Run Audit" to analyze the visual evidence against the SOP.
4. **Review Results**: Examine the audit results including:
   - Executive Summary (Pass/Fail/Caution)
   - Protocol Matches
   - Discrepancy Log
   - Reasoning Trace

## Project Structure

```
├── src/
│   ├── app.component.ts      # Main Angular component
│   ├── app.component.html    # Template
│   ├── environments/         # Environment configs
│   └── models/               # TypeScript interfaces
├── services/
│   └── gemini.service.ts     # Gemini API integration
├── index.tsx                 # Application bootstrap
├── index.html                # HTML entry point
├── angular.json              # Angular CLI config
├── tsconfig.json             # TypeScript config
└── package.json              # Dependencies
```

## Technologies

- Angular 21
- Google Gemini 2.5 Flash
- Tailwind CSS
- TypeScript

