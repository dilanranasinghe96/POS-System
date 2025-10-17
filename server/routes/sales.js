const express = require('express');
const salesController = require('../controllers/salesController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Route order matters! Put specific routes before parameter routes
router.get('/report', authenticate, authorize('admin', 'manager'), salesController.getSalesReport);

// Add debugging middleware for sales routes
router.use((req, res, next) => {
  console.log(`[Sales Route] ${req.method} ${req.originalUrl}`);
  next();
});

// Standard CRUD routes
router.post('/', authenticate, salesController.createSale);
router.get('/', authenticate, salesController.getAllSales);

// Routes with ID parameter
router.get('/:id', authenticate, (req, res, next) => {
  console.log(`[Sales Route] Fetching sale with ID: ${req.params.id}`);
  next();
}, salesController.getSaleById);

router.patch('/:id/status', authenticate, authorize('admin', 'manager'), salesController.updateSaleStatus);
router.post('/return-item', authenticate, authorize('admin', 'manager'), salesController.returnSingleItem);
router.get('/:id/receipt', authenticate, salesController.generateReceipt);

module.exports = router;