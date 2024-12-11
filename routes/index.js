const express = require('express');
const AppController = require('../controllers/AppController');
const UsersController = require('../controllers/UsersController');
const AuthController = require('../controllers/AuthController');

const router = express.Router();

// GET routes
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);
router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);
router.get('/users/me', UsersController.getMe);

// SET routes
router.post('/users', UsersController.postNew);

module.exports = router;
