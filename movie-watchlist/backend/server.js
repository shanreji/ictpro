
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Movie = require("./models/movie");
const Counter = require("./models/counter");

const app = express();
app.use(cors());
app.use(express.json());

const currentYear = new Date().getFullYear();

function send(res, status, success, message, data = null) {
  return res.status(status).json({ success, message, data });
}

// Validate the movie fields shared by create and edit
function validateFields(body, creating = false) {
  const errors = [];
  const required = [
    "title", "genre", "releaseYear", "runtime", "platform", "priority"
  ];

  if (creating) {
    for (const field of required) {
      if (body[field] === undefined || body[field] === "") {
        errors.push(`${field} is required`);
      }
    }
  }

  if (body.title !== undefined &&
      (typeof body.title !== "string" || !body.title.trim())) {
    errors.push("Title is required");
  }

  if (body.releaseYear !== undefined &&
      (!Number.isInteger(Number(body.releaseYear)) ||
       Number(body.releaseYear) < 1950 ||
       Number(body.releaseYear) > currentYear)) {
    errors.push(`Release year must be between 1950 and ${currentYear}`);
  }

  if (body.runtime !== undefined &&
      (!Number.isInteger(Number(body.runtime)) ||
       Number(body.runtime) < 30 || Number(body.runtime) > 300)) {
    errors.push("Runtime must be between 30 and 300 minutes");
  }

  if (body.priority !== undefined &&
      (!Number.isInteger(Number(body.priority)) ||
       Number(body.priority) < 1 || Number(body.priority) > 5)) {
    errors.push("Priority must be between 1 and 5");
  }

  const genres = [
    "Action", "Comedy", "Drama", "Horror",
    "Sci-Fi", "Romance", "Thriller"
  ];

  const platforms = [
    "Netflix", "Prime Video", "Hotstar", "Theatre", "Other"
  ];

  if (body.genre !== undefined && !genres.includes(body.genre)) {
    errors.push("Invalid genre");
  }

  if (body.platform !== undefined && !platforms.includes(body.platform)) {
    errors.push("Invalid platform");
  }

  return errors;
}

// Health check
app.get("/", (req, res) =>
  send(res, 200, true, "Movie Watchlist API is running")
);

// CREATE movie
app.post("/api/movies", async (req, res, next) => {
  try {
    const errors = validateFields(req.body, true);
    if (errors.length) return send(res, 400, false, errors.join("; "));

    const { title, genre, releaseYear, runtime, platform, priority } = req.body;
    const year = Number(releaseYear);
    const titleKey = title.trim().toLowerCase();

    const duplicate = await Movie.findOne({ titleKey, releaseYear: year });
    if (duplicate) {
      return send(res, 409, false, "This movie title and release year already exist");
    }

    // Atomic counter: separate sequence for each release year
    const counter = await Counter.findOneAndUpdate(
      { _id: year },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const movieCode =
      `MV-${year}-${String(counter.sequence).padStart(3, "0")}`;

    const movie = await Movie.create({
      movieCode,
      title: title.trim(),
      titleKey,
      genre,
      releaseYear: year,
      runtime: Number(runtime),
      platform,
      priority: Number(priority),
      status: "To Watch",
      rating: null,
      watchedDate: null
    });

    send(res, 201, true, "Movie added successfully", movie);
  } catch (error) {
    if (error.code === 11000) {
      return send(res, 409, false, "This movie already exists");
    }
    next(error);
  }
});

// READ movies: filters, search and pagination
app.get("/api/movies", async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 6);

    if (!Number.isInteger(page) || page < 1 ||
        !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return send(res, 400, false,
        "Page and limit must be positive integers; limit cannot exceed 100");
    }

    const filter = {};

    if (req.query.status) {
      if (!["To Watch", "Watching", "Watched"].includes(req.query.status)) {
        return send(res, 400, false, "Invalid status filter");
      }
      filter.status = req.query.status;
    }

    if (req.query.genre) {
      const genres = [
        "Action", "Comedy", "Drama", "Horror",
        "Sci-Fi", "Romance", "Thriller"
      ];
      if (!genres.includes(req.query.genre)) {
        return send(res, 400, false, "Invalid genre filter");
      }
      filter.genre = req.query.genre;
    }

    const titleSearch = req.query.title || req.query.search;
    if (titleSearch) {
      const escapedTitle = String(titleSearch).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.title = { $regex: escapedTitle, $options: "i" };
    }

    const totalMovies = await Movie.countDocuments(filter);
    const totalPages = Math.ceil(totalMovies / limit);

    const movies = await Movie.aggregate([
      { $match: filter },
      {
        $addFields: {
          statusOrder: { $cond: [{ $eq: ["$status", "To Watch"] }, 0, 1] }
        }
      },
      { $sort: { statusOrder: 1, priority: -1, runtime: 1, createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: { statusOrder: 0 } }
    ]);

    send(res, 200, true, "Movies fetched successfully", {
      movies,
      currentPage: page,
      limit,
      totalPages,
      totalMovies
    });
  } catch (error) {
    next(error);
  }
});

// WATCH NEXT: highest priority, shortest runtime breaks ties
app.get("/api/movies/watch-next", async (req, res, next) => {
  try {
    const movie = await Movie.findOne({ status: "To Watch" })
      .sort({ priority: -1, runtime: 1 });

    if (!movie) {
      return send(res, 404, false, "No movies are waiting to be watched");
    }

    send(res, 200, true, "Here is your next movie", movie);
  } catch (error) {
    next(error);
  }
});

// STATISTICS
app.get("/api/movies/stats", async (req, res, next) => {
  try {
    const counts = await Movie.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const statusCounts = {
      "To Watch": 0,
      Watching: 0,
      Watched: 0
    };

    counts.forEach(item => {
      statusCounts[item._id] = item.count;
    });

    const watched = await Movie.aggregate([
      { $match: { status: "Watched" } },
      {
        $group: {
          _id: null,
          totalRuntime: { $sum: "$runtime" },
          averageRating: { $avg: "$rating" }
        }
      }
    ]);

    const genres = await Movie.aggregate([
      { $match: { status: "Watched" } },
      { $group: { _id: "$genre", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 1 }
    ]);

    const runtime = watched[0]?.totalRuntime || 0;
    const average = watched[0]?.averageRating || 0;

    send(res, 200, true, "Statistics fetched successfully", {
      statusCounts,
      totalHoursWatched: Math.round((runtime / 60) * 10) / 10,
      averageRating: Math.round(average * 10) / 10,
      topWatchedGenre: genres[0]?._id || null
    });
  } catch (error) {
    next(error);
  }
});

// READ one movie
app.get("/api/movies/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return send(res, 400, false, "Invalid movie ID");
    }

    const movie = await Movie.findById(req.params.id);
    if (!movie) return send(res, 404, false, "Movie not found");

    send(res, 200, true, "Movie fetched successfully", movie);
  } catch (error) {
    next(error);
  }
});

// EDIT allowed movie details (not code or release year)
app.put("/api/movies/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return send(res, 400, false, "Invalid movie ID");
    }

    const movie = await Movie.findById(req.params.id);
    if (!movie) return send(res, 404, false, "Movie not found");

    const allowed = ["title", "genre", "runtime", "platform", "priority"];
    const keys = Object.keys(req.body);

    if (keys.some(key => !allowed.includes(key))) {
      return send(res, 400, false,
        "Only title, genre, runtime, platform and priority can be edited");
    }

    const errors = validateFields(req.body);
    if (errors.length) return send(res, 400, false, errors.join("; "));

    if (req.body.title !== undefined) {
      const title = req.body.title.trim();
      const titleKey = title.toLowerCase();

      const duplicate = await Movie.findOne({
        titleKey,
        releaseYear: movie.releaseYear,
        _id: { $ne: movie._id }
      });

      if (duplicate) {
        return send(res, 409, false,
          "Another movie with this title and release year already exists");
      }

      movie.title = title;
      movie.titleKey = titleKey;
    }

    for (const key of allowed) {
      if (key !== "title" && req.body[key] !== undefined) {
        movie[key] = ["runtime", "priority"].includes(key)
          ? Number(req.body[key])
          : req.body[key];
      }
    }

    await movie.save();
    send(res, 200, true, "Movie updated successfully", movie);
  } catch (error) {
    if (error.code === 11000) {
      return send(res, 409, false, "This movie already exists");
    }
    next(error);
  }
});

// CHANGE status
app.patch("/api/movies/:id/status", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return send(res, 400, false, "Invalid movie ID");
    }

    const movie = await Movie.findById(req.params.id);
    if (!movie) return send(res, 404, false, "Movie not found");

    const { status, rating } = req.body;
    const transitions = {
      "To Watch": ["Watching", "Watched"],
      "Watching": ["Watched", "To Watch"],
      "Watched": []
    };

    if (!transitions[movie.status].includes(status)) {
      return send(res, 400, false,
        `Cannot change status from ${movie.status} to ${status}`);
    }

    if (status === "Watched") {
      if (rating === undefined || rating === null || rating === "") {
        return send(res, 400, false, "Rating is required when marking a movie Watched");
      }

      if (!Number.isInteger(Number(rating)) ||
          Number(rating) < 1 || Number(rating) > 10) {
        return send(res, 400, false, "Rating must be an integer from 1 to 10");
      }

      movie.rating = Number(rating);
      movie.watchedDate = new Date();
    } else if (rating !== undefined) {
      return send(res, 400, false, "Rating is only allowed for Watched movies");
    }

    movie.status = status;
    await movie.save();

    send(res, 200, true, "Movie status updated successfully", movie);
  } catch (error) {
    next(error);
  }
});

// EDIT rating of an already Watched movie
app.patch("/api/movies/:id/rating", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return send(res, 400, false, "Invalid movie ID");
    }

    const movie = await Movie.findById(req.params.id);
    if (!movie) return send(res, 404, false, "Movie not found");

    if (movie.status !== "Watched") {
      return send(res, 400, false, "Only Watched movies can be rated");
    }

    const rating = Number(req.body.rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      return send(res, 400, false, "Rating must be an integer from 1 to 10");
    }

    movie.rating = rating;
    await movie.save();

    send(res, 200, true, "Rating updated successfully", movie);
  } catch (error) {
    next(error);
  }
});

// DELETE movie: Watching movies cannot be deleted
app.delete("/api/movies/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return send(res, 400, false, "Invalid movie ID");
    }

    const movie = await Movie.findById(req.params.id);
    if (!movie) return send(res, 404, false, "Movie not found");

    if (movie.status === "Watching") {
      return send(res, 400, false, "Watching movies cannot be deleted");
    }

    await movie.deleteOne();
    send(res, 200, true, "Movie deleted successfully", movie);
  } catch (error) {
    next(error);
  }
});

app.use((req, res) =>
  send(res, 404, false, "Route not found")
);

// Consistent error response
app.use((error, req, res, next) => {
  console.error(error.message);

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return send(res, 400, false, "Request body contains invalid JSON");
  }

  if (error.name === "ValidationError" ||
      error.name === "CastError") {
    return send(res, 400, false, error.message);
  }

  send(res, 500, false, "Internal server error");
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

if (!process.env.MONGO_URI) {
  console.error("MongoDB connection failed: MONGO_URI is not set in backend/.env");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error("MongoDB connection failed:", error.message);
    process.exitCode = 1;
  });
