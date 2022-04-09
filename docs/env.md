# Environment Variables

- Ask for the .env.local to get the unrestricted Mapbox key and Firebase dev api key for working on localhost
- For Vercel deployment, putting each line from the contents of a private .env file into an environment variable will work also (e.g. VITE_FIREBASE_CONFIG=<stringifiedconfig>)

- The dictionary import script in /functions requires a .env file.