
const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema(
  {
    movieCode: {
      type: String,
      unique: true,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    titleKey: {
      type: String,
      required: true,
    },

    genre: {
      type: String,
      required: true,
      enum: [
        "Action",
        "Comedy",
        "Drama",
        "Horror",
        "Sci-Fi",
        "Romance",
        "Thriller",
      ],
    },

    releaseYear: {
      type: Number,
      required: true,
      min: 1950,
      max: new Date().getFullYear(),
      validate: {
        validator: Number.isInteger,
        message: "Release year must be an integer",
      },
    },

    runtime: {
      type: Number,
      required: true,
      min: 30,
      max: 300,
      validate: {
        validator: Number.isInteger,
        message: "Runtime must be an integer",
      },
    },

    platform: {
      type: String,
      required: true,
      enum: [
        "Netflix",
        "Prime Video",
        "Hotstar",
        "Theatre",
        "Other",
      ],
    },

    priority: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Priority must be an integer",
      },
    },

    status: {
      type: String,
      enum: ["To Watch", "Watching", "Watched"],
      default: "To Watch",
    },

    rating: {
      type: Number,
      min: 1,
      max: 10,
      default: null,
      validate: {
        validator: value => value == null || Number.isInteger(value),
        message: "Rating must be an integer",
      },
    },

    watchedDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

movieSchema.index(
  { titleKey: 1, releaseYear: 1 },
  { unique: true }
);

module.exports = mongoose.model("Movie", movieSchema);
