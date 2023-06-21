const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, "Review can't be empty"],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: [true, 'Review must have a rating'],
    },
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name photo',
  });

  // this.populate({
  //   path: 'tour',
  //   select: 'name',
  // });

  next();
});

// we use statics to define static function to make this === review model
reviewSchema.statics.calcRatingsAverage = async function (tourId) {
  const stats = await this.aggregate([
    {
      // select the tour with that tourId
      $match: {
        tour: tourId,
      },
    },
    {
      // calc the number of reviews and the avg rating on that tour from review collection
      $group: {
        _id: '$tour',
        numRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  // Update Tour ratingsQuantity and ratingsAverage which are like a placeholders
  await Tour.findByIdAndUpdate(tourId, {
    ratingsQuantity: stats[0].numRating,
    ratingsAverage: stats[0].avgRating,
  });
};

reviewSchema.post('save', function () {
  // this.tour === tourId on that review
  this.constructor.calcRatingsAverage(this.tour);
});

reviewSchema.post(/^findOneAnd/, async (doc) => {
  if (doc) await doc.constructor.calcRatingsAverage(doc.tour);
});

// each user is allowed to write only one review
reviewSchema.index({ user: 1, tour: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
