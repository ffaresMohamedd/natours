const Review = require('../models/reviewModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.checkReviewOwner = catchAsync(async (req, res, next) => {
  // find the review
  const review = await Review.findById(req.params.reviewId);

  // check if the user deleting the review is the one who wrote it
  if (req.user._id.toString() !== review.user._id.toString())
    return next(
      new AppError(
        'UnAuthorized user only the user who wrote the review can delete it',
        401
      )
    );
  req.params.id = req.params.reviewId;
  next();
});

exports.setBodyReview = (req, res, next) => {
  const reqObj = {
    review: req.body.review,
    rating: req.body.rating,
    user: req.user._id,
    tour: req.params.tourId,
  };
  req.body = reqObj;
  next();
};

exports.getAllReviews = factory.getAll(Review);
exports.createReview = factory.createOne(Review);
exports.deleteReview = factory.deleteOne(Review);
exports.updateReview = factory.updateOne(Review);
// exports.updateReview = catchAsync(async (req, res, next) => {
//   // update the review
//   const updatedReview = await Review.findByIdAndUpdate(req.params.reviewId, {
//     review: req.body.review,
//     rating: req.body.rating,
//   });

//   res.status(200).json({
//     status: 'success',
//     data: {
//       review: updatedReview,
//     },
//   });
// });
