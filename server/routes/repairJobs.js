const express = require('express');
const router = express.Router();
const {
  getAllRepairJobs,
  getRepairJobById,
  createRepairJob,
  updateRepairJob,
  addPart,
  addLabor,
  addService,
  addNote,
  convertToSale,
  deleteRepairJob,
  getRepairJobStats
} = require('../controllers/repairJobController');
const { authenticate, checkShopAccess } = require('../middleware/auth');

// Get all repair jobs
router.get('/', authenticate, checkShopAccess, getAllRepairJobs);

// Get repair job statistics
router.get('/stats', authenticate, checkShopAccess, getRepairJobStats);

// Get repair job by ID
router.get('/:id', authenticate, checkShopAccess, getRepairJobById);

// Create new repair job
router.post('/', authenticate, checkShopAccess, createRepairJob);

// Update repair job
router.put('/:id', authenticate, checkShopAccess, updateRepairJob);

// Add part to repair job
router.post('/:id/parts', authenticate, checkShopAccess, addPart);

// Add labor to repair job
router.post('/:id/labor', authenticate, checkShopAccess, addLabor);

// Add service to repair job
router.post('/:id/services', authenticate, checkShopAccess, addService);

// Add note to repair job
router.post('/:id/notes', authenticate, checkShopAccess, addNote);

// Convert repair job to sale
router.post('/:id/convert-to-sale', authenticate, checkShopAccess, convertToSale);

// Delete repair job
router.delete('/:id', authenticate, checkShopAccess, deleteRepairJob);

module.exports = router;
