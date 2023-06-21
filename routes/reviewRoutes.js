const express = require('express');
const reviewController = require('../controllers/reviewController');
const authController = require('../controllers/authController');

// mergeParams to get the parameters from the url in the tour routes
const router = express.Router({ mergeParams: true });

// All reviews are protected
router.use(authController.protect);

router
  .route('/')
  .get(reviewController.getAllReviews)
  .post(
    authController.restrictTo('user'),
    reviewController.setBodyReview,
    reviewController.createReview
  )
  .delete(
    authController.restrictTo('admin', 'user'),
    reviewController.checkReviewOwner,
    reviewController.deleteReview
  )
  .patch(
    authController.restrictTo('admin', 'user'),
    reviewController.checkReviewOwner,
    reviewController.setBodyReview,
    reviewController.updateReview
  );

module.exports = router;
