# Frame by Frame — Movie Watchlist

A MERN watchlist manager. The frontend is React + Vite; the API uses Express and Mongoose.

## Setup

1. Install backend dependencies:
   ```powershell
   cd backend
   npm install
   ```
2. Copy `backend/.env.example` to `backend/.env` and set `MONGO_URI` to your own MongoDB Atlas connection string. Replace the placeholders with your Atlas database user, password, cluster host, and database name. Do not commit `.env`. `PORT` is optional and defaults to `5000`.
3. In a separate terminal, install frontend dependencies:
   ```powershell
   cd frontend
   npm install
   ```
4. Optionally copy `frontend/.env.example` to `frontend/.env` to set `VITE_API_BASE_URL`. It defaults to `http://localhost:5000/api`.
5. Start both applications using the commands below.

The app does not contain a MongoDB URI or credentials. Supply a valid Atlas URI in `backend/.env` before starting the API.

## Run locally

**Terminal 1 — backend**
```powershell
cd C:\Users\USER\OneDrive\Desktop\movie-watchlist\backend
npm run dev
```

**Terminal 2 — frontend**
```powershell
cd C:\Users\USER\OneDrive\Desktop\movie-watchlist\frontend
npm run dev
```

Open the Vite URL printed in Terminal 2 (usually `http://localhost:5173`). The backend health check is at `http://localhost:5000/`.

## API

All API responses use `{ "success": boolean, "message": string, "data": any }`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/movies` | Add a movie; creates `movieCode` on the server |
| GET | `/api/movies?status=&genre=&title=&page=1&limit=6` | Filter, search, and paginate movies |
| GET | `/api/movies/watch-next` | Highest-priority To Watch movie, shortest runtime as tie-breaker |
| GET | `/api/movies/stats` | Status counts, watched hours, average rating, and top watched genre |
| GET | `/api/movies/:id` | Get one movie |
| PUT | `/api/movies/:id` | Edit title, genre, runtime, platform, or priority |
| PATCH | `/api/movies/:id/status` | Change status; include rating when marking Watched |
| PATCH | `/api/movies/:id/rating` | Change rating of a Watched movie |
| DELETE | `/api/movies/:id` | Delete a movie except when it is Watching |

Status transitions: To Watch → Watching or Watched; Watching → Watched or To Watch; Watched is final. A movie title cannot be repeated for the same release year, ignoring case.

## Configuration

- `backend/.env`: `MONGO_URI` (required), `PORT` (optional; default `5000`)
- `frontend/.env`: `VITE_API_BASE_URL` (optional; default `http://localhost:5000/api`)

## Screenshots

![Watchlist dashboard screenshot](./screenshots/watchlist-dashboard.png)

![Movie form and statistics screenshot](./screenshots/movie-form-statistics.png)
