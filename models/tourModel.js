const mongoose = require('mongoose');
const validator = require('validator');
// const User = require('./userModel');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A Tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must be less than or equal 40 characters'],
      minlength: [
        10,
        'A tour name must be greater than or equal 10 characters',
      ],
      validate: [validator.isAlpha, 'Tour name must only contain characters'],
    },
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a max Group Size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty must be either easy, medium or difficult',
      },
    },
    price: {
      type: Number,
      required: [true, 'A Tour must have a price'],
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Ratings must be above 1.0'],
      max: [5, 'Ratings must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10, // 4.6666  46.66666  47  4.7
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          return val < this.price;
        },
        message: 'Discount price must be less than regular price',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a summary'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      // required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    startLocation: {
      // GEOSPATIAL
      // geoJSON
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      // embedded document
      // GEOSPATIAL
      // geoJSON
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
      },
    ],
    // guides: Array,
    guides: [
      // refrencing users
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Using embedding
// we embed users into tours document
// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map((id) => User.findById(id));
//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

// to populate guides in all find quiries
tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });

  next();
});

// Defining indexes for faster reading for most queried fields and not written to or
// updated alot
tourSchema.index({ price: 1, ratingsAverage: -1 });

// geospatial index for higher performance
tourSchema.index({ startLocation: '2dsphere' });

tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});

// Virtual populate
// to make the tour know about the reviews
// we use parent refrencing in the Review and child refrencing with virtual population
// on tour bec if we just used child refrencing we will have that big array in
// our DB so we keep it virtual so we have array of reviews on this tour but
// it is virtual not persisted to our DB
tourSchema.virtual('reviews', {
  // the refrence where we use parent refrencing
  ref: 'Review',
  // where the tour id is stored in the review
  foreignField: 'tour',
  // where that id is stored here in the tour
  localField: '_id',
});

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
