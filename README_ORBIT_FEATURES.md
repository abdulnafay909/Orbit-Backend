# ORBIT chat features in this build

## Frontend setup
From the React Native project root, run `npm install` to resolve the newly added `react-native-document-picker` dependency and refresh `package-lock.json`. Clipboard is declared as `@react-native-clipboard/clipboard`; if Metro reports it missing, run `npm install @react-native-clipboard/clipboard` as well.

For Android, rebuild after native package installation:
```powershell
cd android
.\gradlew clean
cd ..
npx.cmd react-native run-android
```

General Chat now uses an authenticated Gemini streaming endpoint. The paperclip button accepts PDF and image files. PDFs with selectable text are extracted on the backend; scanned PDFs are not OCR'd in this build. The globe button runs a live search and displays source URLs in the response.

## Backend setup
From the backend folder, run `npm install` to update the lockfile and install `multer`, `pdf-parse`, and their TypeScript types. Then run `npm run build` and `npm run dev`.

Optional environment variables:
```env
TAVILY_API_KEY=your_tavily_key
GEMINI_VISION_MODEL=gemini-2.5-flash
GEMINI_STREAM_MODEL=gemini-2.5-flash
```

`TAVILY_API_KEY` is required for live web search. Image analysis and true token streaming require a valid Gemini API key and access to the selected models. All API keys belong in the backend environment only, never in the mobile app.

File uploads are limited to 10 MB and accepted types are PDF, JPEG, PNG, WEBP, and GIF. Uploaded files are processed in memory and are not saved as a permanent file library. PDF text extraction currently handles text-based PDFs; scanned PDFs need OCR support in a future phase.

## Important
The ZIP does not include `.env`. Configure production secrets in your host's environment settings. Use `npm install` rather than `npm ci` on the first install so the lockfile can be refreshed for the added packages.
