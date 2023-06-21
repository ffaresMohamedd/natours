const express = require('express');
const tourController = require('../controllers/tourController');
const authController = require('../controllers/authController');
const reviewRouter = require('./reviewRoutes');
//////////////

const router = express.Router();

// when router finds this url will be redirected to reviewRoutes
router.use('/:tourId/reviews/:reviewId', reviewRouter);
router.use('/:tourId/reviews', reviewRouter);

// for geospatial
router
  .route('/within-distance/:distance/location/:latlng/unit/:unit')
  .get(tourController.getToursWithin);

router
  .route('/distances/location/:latlng/unit/:unit')
  .get(tourController.getDistances);

router
  .route('/top-5-cheap')
  .get(tourController.aliasTopCheap, tourController.getAllTours);

router.route('/tour-stats').get(tourController.getTourStats);

router
  .route('/monthly-plan/:year')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide', 'guide'),
    tourController.getMonthlyPlan
  );

router
  .route('/')
  .get(tourController.getAllTours)
  .post(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.createTour
  );
router
  .route('/:id')
  .get(tourController.getTour)
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.uploadTourImages,
    tourController.resizeTourImages,
    tourController.updateTour
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.deleteTour
  );

// Nested routes for reviews on tour

// router
//   .route('/:tourId/reviews')
//   .get(authController.protect, reviewController.getAllReviews)
//   .post(
//     authController.protect,
//     authController.restrictTo('user'),
//     reviewController.createReview
//   );

// router
//   .route('/:tourId/reviews/:reviewId')
//   .delete(authController.protect, reviewController.deleteReview)
//   .patch(authController.protect, reviewController.updateReview);

module.exports = router;
