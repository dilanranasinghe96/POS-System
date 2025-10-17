const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllServices,
  getServiceById,
  createService,
  updateServiceStatus,
  getServiceStats
} = require('../controllers/serviceController');

// Apply authentication to all routes
router.use(authenticate);

// Get service statistics
router.get('/stats', getServiceStats);

// Get all services with pagination and filtering
router.get('/', getAllServices);

// Get service by ID
router.get('/:id', getServiceById);

// Create new service
router.post('/', createService);

// Update service status
router.patch('/:id/status', updateServiceStatus);

module.exports = router;
