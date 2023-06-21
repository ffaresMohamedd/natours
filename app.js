const fs = require('fs');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/appErrorController');

const app = express();
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');

// Global Middlewares

// Set Security HTTP headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit Request numbers
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again later',
});
app.use('/api', limiter);

// Body parser , Reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

// Defend against NOSQL injection
app.use(mongoSanitize());

// Defend against cross site scripting XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'ratingsAverage',
      'ratingsQuantity',
      'duration',
      'price',
      'maxGroupSize',
      'difficulty',
    ],
  })
);

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

//Routing
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);

// handle all routes that donot exist on our server
app.all('*', (req, res, next) => {
  //   res.status(404).json({
  // status: 'fail',
  // message: `Couldn't find ${req.originalUrl} on this server!`
  //   });
  ////////////////////////////////////
  // const err = new Error(`Couldn't find ${req.originalUrl} on this server!`);
  // err.status = 'fail';
  // err.statusCode = 404;
  // when passing parameter to next it know that it is an error and skip
  // all the next middlewares and pass it to the global error handling middleware
  // next(err);
  /////////////////////////////////////
  next(new AppError(`Couldn't find ${req.originalUrl} on this server!`), 404);
});

// IMPLEMENTING a global error handling middleware
app.use(globalErrorHandler);

module.exports = app;
