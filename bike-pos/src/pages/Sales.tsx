import React, { useEffect, useState } from 'react';
import {
    Badge,
    Button,
    Card,
    Col,
    Container,
    Form,
    InputGroup,
    Modal,
    Row,
    Spinner,
    Table
} from 'react-bootstrap';
import {
    ArrowRepeat,
    Bag,
    Funnel,
    Printer,
    Search
} from 'react-bootstrap-icons';
import { useAuth } from '../contexts/AuthContext'; // Add this import
import { useNotification } from '../contexts/NotificationContext';
import { salesApi } from '../services/api';

// Define Sales types
interface SaleItem {
  id?: string;
  _id?: string;
  product?: {
    _id: string;
    name: string;
    barcode?: string;
    sku?: string;
  };
  quantity: number;
  price: number;
  discount: number;
  subtotal?: number;
  total?: number;
  unitPrice?: number;
  Product?: {
    id?: string;
    name?: string;
    barcode?: string;
  };
  isManual?: boolean;
  isService?: boolean;
  name?: string;
  returnedQuantity?: number;
}

interface Sale {
  id: string | number;
  _id?: string;
  invoiceNumber: string;
  date: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  status: 'completed' | 'returned' | 'cancelled' | 'partially_returned';
  cashier?: {
    id: string;
    username: string;
  };
  user?: {
    name: string;
    username: string;
  };
  SaleItems?: SaleItem[];
  createdAt: string;
  returnedAmount?: number;
  returnHistory?: Array<{
    itemId: string;
    itemName: string;
    returnQuantity: number;
    returnAmount: number;
    reason: string;
    returnedAt: string;
  }>;
}

interface ReceiptData {
  id: string | number;
  invoiceNumber: string;
  date: string;
  customer: string;
  cashier: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
}

const Sales: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [printingReceipt, setPrintingReceipt] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalSales, setTotalSales] = useState(0);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [processingReturn, setProcessingReturn] = useState(false);
  
  // Individual item return states
  const [returnType, setReturnType] = useState<'full' | 'partial'>('full');
  const [itemsToReturn, setItemsToReturn] = useState<{ [key: string]: number }>({});

  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');

  useEffect(() => {
    fetchSales();
  }, [page, rowsPerPage, startDate, endDate, paymentMethodFilter, statusFilter, searchQuery]);

  const formatDateForApi = (date: Date | null) => {
    if (!date) return undefined;
    return date.toISOString().split('T')[0];
  };

  const formatDateForInput = (date: Date | null) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const handleDateChange = (dateString: string, setter: React.Dispatch<React.SetStateAction<Date | null>>) => {
    if (!dateString) {
      setter(null);
      return;
    }
    setter(new Date(dateString));
  };

  const fetchSales = async () => {
    try {
      setLoading(true);

      const response = await salesApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        startDate: formatDateForApi(startDate),
        endDate: formatDateForApi(endDate),
        paymentMethod: paymentMethodFilter,
        status: statusFilter,
      });

      setSales(response.data.sales);
      setTotalSales(response.data.totalSales);

    } catch (err) {
      console.error('Error fetching sales:', err);
      showError('Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (pageNumber: number) => {
    setPage(pageNumber);
  };

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleResetFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setPaymentMethodFilter('');
    setStatusFilter('');
    setSearchQuery('');
  };

  const handleOpenDetailDialog = async (saleId: string) => {
    try {
      if (!saleId || typeof saleId !== 'string' || saleId.trim() === '') {
        console.error('Invalid sale ID detected:', saleId);
        setError(`Invalid sale ID: ${saleId}`);
        return;
      }

      setLoading(true);
      const response = await salesApi.getById(saleId);

      if (!response.data) {
        console.error('No data received for sale ID:', saleId);
        throw new Error('Sale data not found');
      }

      if (!response.data.id && response.data._id) {
        response.data.id = response.data._id;
      }

      setSelectedSale(response.data);
      setDetailDialogOpen(true);
    } catch (err) {
      console.error('Error fetching sale details:', err);
      setError(`Failed to load sale details: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setSelectedSale(null);
  };

  const handleOpenReturnDialog = () => {
    if (!selectedSale) return;

    setReturnReason('');
    setReturnType('full');
    setItemsToReturn({});
    setReturnDialogOpen(true);
  };

  const handleCloseReturnDialog = () => {
    setReturnDialogOpen(false);
    setReturnReason('');
    setReturnType('full');
    setItemsToReturn({});
  };

  const handleItemReturnQuantityChange = (itemId: string, quantity: number, maxQuantity: number) => {
    const validQuantity = Math.max(0, Math.min(quantity, maxQuantity));
    setItemsToReturn(prev => ({
      ...prev,
      [itemId]: validQuantity
    }));
  };

  const handleProcessReturn = async () => {
    if (!selectedSale) return;

    try {
      setProcessingReturn(true);

      if (returnType === 'full') {
        // Full return - mark entire sale as returned
        await salesApi.updateStatus(selectedSale.id, {
          status: 'returned',
          reason: returnReason,
        });
        setSuccessMessage('Sale returned successfully');
      } else {
        // Partial return - return specific items
        const returnItems = Object.entries(itemsToReturn)
          .filter(([_, quantity]) => quantity > 0)
          .map(([itemId, quantity]) => ({
            itemId,
            quantity
          }));

        if (returnItems.length === 0) {
          setError('Please select at least one item to return');
          setProcessingReturn(false);
          return;
        }

        // Process each item return separately using the returnSingleItem API
        let successCount = 0;
        let failedCount = 0;

        for (const item of returnItems) {
          try {
            const returnData = {
              saleId: String(selectedSale.id),
              itemId: item.itemId,
              returnQuantity: item.quantity,
              reason: returnReason
            };
            
            console.log('Returning item:', returnData);
            
            await salesApi.returnSingleItem(returnData);
            successCount++;
          } catch (itemError) {
            console.error(`Failed to return item ${item.itemId}:`, itemError);
            failedCount++;
          }
        }

        if (successCount > 0) {
          setSuccessMessage(
            `Successfully returned ${successCount} item(s)` + 
            (failedCount > 0 ? `. ${failedCount} item(s) failed.` : '')
          );
        } else {
          setError('Failed to return any items');
        }
      }

      handleCloseReturnDialog();
      handleCloseDetailDialog();
      fetchSales();

    } catch (err) {
      console.error('Error processing return:', err);
      setError(err instanceof Error ? err.message : 'Failed to process return');
    } finally {
      setProcessingReturn(false);
    }
  };

  const directPrintReceipt = async (sale: Sale) => {
    try {
      setPrintingReceipt(true);

      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = 'none';
      document.body.appendChild(printIframe);

      const currentShop = user?.shopId ? { name: user.shopId.name } : null;
      const shopName = currentShop?.name || "Bike Shop";
      const shopPhone = user?.shopId?.phone || "";
      const shopAddress = user?.shopId?.address || "";

      const receiptItems = sale.SaleItems?.map(item => {
        const isManualItem = item.isManual || (!item.product && !item.Product);
        const productName = isManualItem
          ? (item.name || 'Manual Item')
          : (item.product?.name || item.Product?.name || 'Unknown Product');
        const unitPrice = item.price || item.unitPrice || 0;
        const itemDiscount = item.discount || 0;
        const subtotal = item.subtotal || (unitPrice * item.quantity);

        return {
          name: productName,
          quantity: item.quantity,
          price: unitPrice,
          discount: itemDiscount,
          total: subtotal - itemDiscount
        };
      }) || [];

      const totalItemDiscounts = receiptItems.reduce((sum, item) => sum + item.discount, 0);
      const totalDiscount = totalItemDiscounts + sale.discount;

      const receiptHtml = `
        <html>
          <head>
            <title>XP-365B Receipt</title>
            <style>
              @page { 
                size: 80mm auto;  
                margin: 0mm;      
              }
              body { 
                font-family: 'Arial', sans-serif; 
                font-size: 12px; 
                width: 72mm;      
                margin: 4mm;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .receipt {
                width: 100%;
              }
              .text-center { 
                text-align: center; 
              }
              hr { 
                border: none; 
                border-top: 1px dashed #000; 
                margin: 5px 0; 
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin: 5px 0;
              }
              th {
                font-weight: bold;
                text-align: left;
                font-size: 11px;
              }
              .item-row td {
                font-size: 12px;
                padding: 2px 0;
                vertical-align: top; 
              }
              .item-name {
                word-wrap: break-word; 
                word-break: break-word; 
                white-space: normal; 
                max-width: 35mm; 
                padding-right: 4px; 
              }
              .discount-text {
                font-size: 10px;
                color: #555;
              }
              .summary-row {
                display: flex;
                justify-content: space-between;
                margin: 2px 0;
                font-size: 12px;
              }
              .total-row {
                font-weight: bold;
                font-size: 14px;
                margin-top: 5px;
              }
              .store-info {
                font-size: 10px;
                margin-top: 10px;
              }
              .paper-cut-space {
                height: 20mm;
              }
            </style>
            <script>
              window.addEventListener('afterprint', function() {
                window.parent.postMessage('printComplete', '*');
              });
            </script>
          </head>
          <body>
            <div class="receipt">
              <div class="text-center">
                <h2 style="margin: 0px 0 4px 0; font-size: 18px;">${shopName}</h2>
                ${shopAddress ? `<p style="margin: 0px 0 4px 0; font-size: 12px;">${shopAddress}</p>` : ''}
                <h3 style="margin: 0px 0 4px 0; font-size: 16px;">RECEIPT</h3>
                <p style="margin: 3px 0; font-size: 11px;">${new Date(sale.date).toLocaleString()}</p>
                <p style="margin: 3px 0; font-size: 11px;">Invoice: ${sale.invoiceNumber}</p>
              </div>
              <hr />
              <div>
                <p style="margin: 2px 0; font-size: 11px;">Customer: ${sale.customerName || 'Walk-in Customer'}</p>
                <p style="margin: 2px 0; font-size: 11px;">Cashier: ${sale.user?.name || 'Unknown'}</p>
              </div>
              <hr />
              <table>
                <thead>
                  <tr>
                    <th style="width: 40%;">Item</th>
                    <th style="width: 15%; text-align: center;">Qty</th>
                    <th style="width: 20%; text-align: right;">Price</th>
                    <th style="width: 25%; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${receiptItems.map(item => `
                    <tr class="item-row">
                      <td class="item-name">
                        ${item.name}
                      </td>
                      <td style="text-align: center;">${item.quantity}</td>
                      <td style="text-align: right;">${item.price.toFixed(2)}</td>
                      <td style="text-align: right;">${item.total.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <hr />
              <div>
                <div class="summary-row">
                  <span>Products Subtotal:</span>
                  <span>Rs. ${sale.subtotal.toFixed(2)}</span>
                </div>
                ${sale.SaleItems && sale.SaleItems.some(item => item.isService) ? `
                  <div class="summary-row">
                    <span>Services Subtotal:</span>
                    <span>Rs. ${sale.SaleItems.filter(item => item.isService).reduce((sum, item) => sum + (item.total || 0), 0).toFixed(2)}</span>
                  </div>
                ` : ''}
                ${totalDiscount > 0 ? `
                  <div class="summary-row">
                    <span>Discount:</span>
                    <span>-Rs. ${totalDiscount.toFixed(2)}</span>
                  </div>
                ` : ''}
                ${sale.tax > 0 ? `
                  <div class="summary-row">
                    <span>Tax:</span>
                    <span>Rs. ${sale.tax.toFixed(2)}</span>
                  </div>
                ` : ''}
                <div class="summary-row total-row">
                  <span>Total:</span>
                  <span>Rs. ${sale.total.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                  <span>Payment Method:</span>
                  <span>${sale.paymentMethod.replace('_', ' ').toUpperCase()}</span>
                </div>
              </div>
              <hr />
              <div class="text-center">
                <p style="margin: 2px 0;">Thank you for your purchase!</p>
                <p style="margin: 2px 0;">Please visit again</p>
                ${shopPhone ? `<p style="margin: 4px 0; font-size: 11px;">Contact us: ${shopPhone}</p>` : ''}
              </div>
              <div class="paper-cut-space"></div>
            </div>
          </body>
        </html>
      `;

      const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(receiptHtml);
        iframeDoc.close();

        const onIframeLoad = () => {
          try {
            printIframe.removeEventListener('load', onIframeLoad);
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
            setTimeout(() => {
              document.body.removeChild(printIframe);
              setPrintingReceipt(false);
            }, 500);
          } catch (err) {
            console.error('Error during iframe print:', err);
            document.body.removeChild(printIframe);
            setPrintingReceipt(false);
          }
        };

        printIframe.addEventListener('load', onIframeLoad);
      } else {
        throw new Error('Could not access iframe document');
      }
    } catch (err) {
      console.error('Error printing receipt:', err);
      setError('Failed to print receipt. Please try again.');
      setPrintingReceipt(false);
    }
  };

  const handlePrintReceipt = async (saleId: string) => {
    try {
      setPrintingReceipt(true);

      let saleForPrinting: Sale;

      if (selectedSale && selectedSale.id === saleId) {
        saleForPrinting = selectedSale;
      } else {
        const response = await salesApi.getById(saleId);
        saleForPrinting = response.data;
      }

      directPrintReceipt(saleForPrinting);

    } catch (err) {
      console.error('Error generating receipt:', err);
      setError('Failed to generate receipt');
      setPrintingReceipt(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatPaymentMethod = (method: string) => {
    return method.replace('_', ' ').toUpperCase();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'returned':
        return 'warning';
      case 'partially_returned':
        return 'info';
      case 'cancelled':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  const totalPages = Math.ceil(totalSales / rowsPerPage);
  const paginationItems = [];

  for (let i = 0; i < totalPages; i++) {
    paginationItems.push(
      <li key={i} className={`page-item ${page === i ? 'active' : ''}`}>
        <button className="page-link" onClick={() => handleChangePage(i)}>
          {i + 1}
        </button>
      </li>
    );
  }

  return (
    <Container fluid className="p-3 p-md-4">
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-4 gap-3">
        <h2 className="mb-0">Sales</h2>
        <Button 
          variant="primary" 
          href="/pos"
          className="d-flex align-items-center"
          size="sm"
        >
          <Bag className="me-2" size={16} /> New Sale
        </Button>
      </div>
      
      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-light d-flex justify-content-between align-items-center py-2">
          <h6 className="mb-0">Filters</h6>
          <Funnel size={16} />
        </Card.Header>
        <Card.Body className="p-3">
          <Row className="g-2">
            <Col xs={12} sm={6} md={4} lg={2}>
              <Form.Group className="mb-0">
                <Form.Label className="small">Start Date</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={formatDateForInput(startDate)}
                  onChange={(e) => handleDateChange(e.target.value, setStartDate)}
                />
              </Form.Group>
            </Col>
            
            <Col xs={12} sm={6} md={4} lg={2}>
              <Form.Group className="mb-0">
                <Form.Label className="small">End Date</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={formatDateForInput(endDate)}
                  onChange={(e) => handleDateChange(e.target.value, setEndDate)}
                />
              </Form.Group>
            </Col>
            
            <Col xs={12} sm={6} md={4} lg={2}>
              <Form.Group className="mb-0">
                <Form.Label className="small">Payment Method</Form.Label>
                <Form.Select
                  size="sm"
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                >
                  <option value="">All Payment Methods</option>
                  <option value="cash">Cash</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="debit_card">Debit Card</option>
                  <option value="mobile_payment">Mobile Payment</option>
                  <option value="other">Other</option>
                </Form.Select>
              </Form.Group>
            </Col>
            
            <Col xs={12} sm={6} md={4} lg={2}>
              <Form.Group className="mb-0">
                <Form.Label className="small">Status</Form.Label>
                <Form.Select
                  size="sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="partially_returned">Partially Returned</option>
                  <option value="returned">Fully Returned</option>
                  <option value="cancelled">Cancelled</option>
                </Form.Select>
              </Form.Group>
            </Col>
            
            <Col xs={12} sm={6} md={4} lg={2}>
              <Form.Group className="mb-0">
                <Form.Label className="small">Search</Form.Label>
                <InputGroup size="sm">
                  <InputGroup.Text>
                    <Search size={14} />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Invoice #"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </InputGroup>
              </Form.Group>
            </Col>
            
            <Col xs={12} sm={6} md={4} lg={2}>
              <Form.Group className="mb-0">
                <Form.Label className="small text-white">.</Form.Label>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="w-100 d-flex align-items-center justify-content-center"
                  onClick={handleResetFilters}
                >
                  <ArrowRepeat className="me-1" size={14} /> Reset
                </Button>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      
      <Card className="shadow-sm">
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th className="px-3 py-2">Invoice #</th>
                  <th className="px-3 py-2 d-none d-md-table-cell">Date</th>
                  <th className="px-3 py-2 d-none d-lg-table-cell">Customer</th>
                  <th className="px-3 py-2 d-none d-sm-table-cell">Payment</th>
                  <th className="px-3 py-2 text-end">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-5">
                      <Spinner animation="border" variant="primary" />
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-5 text-muted">
                      No sales found
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr 
                      key={sale.id} 
                      onClick={() => {
                        console.log('Row clicked with sale ID:', sale.id);
                        if (sale && sale.id) {
                          handleOpenDetailDialog(String(sale.id));
                        } else {
                          console.error('Sale ID is undefined');
                          setError('Cannot view details: Sale ID is undefined');
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                      className="align-middle"
                    >
                      <td className="px-3 py-2">
                        <div className="fw-medium">{sale.invoiceNumber}</div>
                        <div className="d-md-none">
                          <small className="text-muted">
                            {formatDate(sale.date)}
                          </small>
                        </div>
                        <div className="d-lg-none">
                          <small className="text-muted">
                            {sale.customerName || 'Walk-in'}
                          </small>
                        </div>
                      </td>
                      <td className="px-3 py-2 d-none d-md-table-cell">
                        <div>{new Date(sale.date).toLocaleDateString()}</div>
                        <small className="text-muted">
                          {new Date(sale.date).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </small>
                      </td>
                      <td className="px-3 py-2 d-none d-lg-table-cell">
                        {sale.customerName || 'Walk-in Customer'}
                      </td>
                      <td className="px-3 py-2 d-none d-sm-table-cell">
                        <small>{formatPaymentMethod(sale.paymentMethod)}</small>
                      </td>
                      <td className="px-3 py-2 text-end">
                        <div className="fw-medium">
                          {sale.returnedAmount && sale.returnedAmount > 0 ? (
                            <>
                              <span className="text-success">Rs. {(sale.total - sale.returnedAmount).toFixed(2)}</span>
                              <div>
                                <small className="text-muted text-decoration-line-through">
                                  Rs. {sale.total.toFixed(2)}
                                </small>
                              </div>
                            </>
                          ) : (
                            <span>Rs. {sale.total.toFixed(2)}</span>
                          )}
                        </div>
                        <div className="d-sm-none">
                          <small className="text-muted">
                            {formatPaymentMethod(sale.paymentMethod)}
                          </small>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge 
                          bg={getStatusBadgeVariant(sale.status)}
                          className="text-uppercase"
                        >
                          {sale.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (sale.id) {
                              handlePrintReceipt(String(sale.id));
                            }
                          }}
                          disabled={printingReceipt}
                          className="d-flex align-items-center justify-content-center mx-auto"
                          style={{ minWidth: '38px', minHeight: '31px' }}
                        >
                          {printingReceipt ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            <Printer size={14} />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
          
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center p-3 border-top gap-3">
            <div className="d-flex align-items-center">
              <span className="me-2 small">Show:</span>
              <Form.Select
                size="sm"
                style={{ width: 'auto' }}
                value={rowsPerPage}
                onChange={handleChangeRowsPerPage}
              >
                {[5, 10, 25, 50].map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Form.Select>
              <span className="ms-2 small text-muted">
                Showing {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, totalSales)} of {totalSales}
              </span>
            </div>
            
            <nav>
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${page === 0 ? 'disabled' : ''}`}>
                  <button 
                    className="page-link" 
                    onClick={() => handleChangePage(page - 1)}
                    disabled={page === 0}
                  >
                    Previous
                  </button>
                </li>
                
                {totalPages <= 5 ? (
                  paginationItems
                ) : (
                  <>
                    {page > 2 && (
                      <>
                        <li className="page-item">
                          <button className="page-link" onClick={() => handleChangePage(0)}>
                            1
                          </button>
                        </li>
                        {page > 3 && <li className="page-item disabled"><span className="page-link">...</span></li>}
                      </>
                    )}
                    
                    {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                      const pageNum = Math.max(0, Math.min(page - 1 + i, totalPages - 1));
                      if (pageNum < 0 || pageNum >= totalPages) return null;
                      
                      return (
                        <li key={pageNum} className={`page-item ${page === pageNum ? 'active' : ''}`}>
                          <button className="page-link" onClick={() => handleChangePage(pageNum)}>
                            {pageNum + 1}
                          </button>
                        </li>
                      );
                    })}
                    
                    {page < totalPages - 3 && (
                      <>
                        {page < totalPages - 4 && <li className="page-item disabled"><span className="page-link">...</span></li>}
                        <li className="page-item">
                          <button className="page-link" onClick={() => handleChangePage(totalPages - 1)}>
                            {totalPages}
                          </button>
                        </li>
                      </>
                    )}
                  </>
                )}
                
                <li className={`page-item ${page === totalPages - 1 ? 'disabled' : ''}`}>
                  <button 
                    className="page-link" 
                    onClick={() => handleChangePage(page + 1)}
                    disabled={page === totalPages - 1}
                  >
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </Card.Body>
      </Card>

      {/* Sale Detail Modal */}
      <Modal show={detailDialogOpen} onHide={handleCloseDetailDialog} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Sale Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedSale && (
            <div>
              <Row className="mb-3">
                <Col md={6}>
                  <strong>Invoice Number:</strong> {selectedSale.invoiceNumber}
                </Col>
                <Col md={6}>
                  <strong>Date:</strong> {formatDate(selectedSale.date)}
                </Col>
                <Col md={6}>
                  <strong>Customer:</strong> {selectedSale.customerName || 'Walk-in Customer'}
                </Col>
                <Col md={6}>
                  <strong>Phone:</strong> {selectedSale.customerPhone || 'N/A'}
                </Col>
                <Col md={6}>
                  <strong>Cashier:</strong> {selectedSale.user?.name || selectedSale.cashier?.username || 'Unknown'}
                </Col>
                <Col md={6}>
                  <strong>Payment Method:</strong> {formatPaymentMethod(selectedSale.paymentMethod)}
                </Col>
                <Col md={6}>
                  <strong>Status:</strong> <Badge bg={getStatusBadgeVariant(selectedSale.status)}>{selectedSale.status}</Badge>
                </Col>
              </Row>
              
              {selectedSale.notes && (
                <Row className="mb-3">
                  <Col>
                    <strong>Notes:</strong> {selectedSale.notes}
                  </Col>
                </Row>
              )}
              
              <h6>Items:</h6>
              <Table striped bordered hover size="sm">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Discount</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.SaleItems?.map((item, index) => {
                    const isManualItem = item.isManual || (!item.product && !item.Product && !item.isService);
                    const isService = item.isService;
                    let productName = '';
                    let itemType = '';
                    
                    if (isService) {
                      productName = item.name || 'Service';
                      itemType = ' (Service)';
                    } else if (isManualItem) {
                      productName = item.name || 'Manual Item';
                      itemType = ' (Manual)';
                    } else {
                      productName = item.product?.name || item.Product?.name || 'Unknown Product';
                    }
                    
                    const unitPrice = item.price || item.unitPrice || 0;
                    const itemDiscount = item.discount || 0;
                    const subtotal = item.subtotal || (unitPrice * item.quantity);
                    
                    const returnedQty = item.returnedQuantity || 0;
                    const effectiveQty = item.quantity - returnedQty;
                    const effectiveSubtotal = effectiveQty > 0 
                      ? (unitPrice * effectiveQty) - (itemDiscount * effectiveQty / item.quantity)
                      : 0;
                    
                    return (
                      <tr key={item.id || item._id || index} className={isService ? 'table-warning' : ''}>
                        <td>
                          {productName}{itemType}
                          {returnedQty > 0 && (
                            <div>
                              <Badge bg="warning" className="mt-1">
                                {returnedQty} returned
                              </Badge>
                            </div>
                          )}
                        </td>
                        <td>
                          {effectiveQty > 0 ? effectiveQty : <span className="text-muted">{item.quantity}</span>}
                          {returnedQty > 0 && effectiveQty === 0 && (
                            <small className="text-danger d-block">Fully Returned</small>
                          )}
                        </td>
                        <td>Rs. {unitPrice.toFixed(2)}</td>
                        <td>Rs. {itemDiscount.toFixed(2)}</td>
                        <td>Rs. {effectiveSubtotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              
              <Row className="mt-3">
                <Col md={6} className="ms-auto">
                  <div className="d-flex justify-content-between">
                    <strong>Products Subtotal:</strong>
                    <span>Rs. {selectedSale.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedSale.SaleItems && selectedSale.SaleItems.some(item => item.isService) && (
                    <div className="d-flex justify-content-between">
                      <strong>Services Subtotal:</strong>
                      <span>Rs. {selectedSale.SaleItems.filter(item => item.isService).reduce((sum, item) => sum + (item.total || 0), 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between">
                    <strong>Discount:</strong>
                    <span>Rs. {selectedSale.discount.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <strong>Tax:</strong>
                    <span>Rs. {selectedSale.tax.toFixed(2)}</span>
                  </div>
                  <hr />
                  <div className="d-flex justify-content-between">
                    <strong>Total:</strong>
                    <strong>Rs. {selectedSale.total.toFixed(2)}</strong>
                  </div>
                  {selectedSale.returnedAmount && selectedSale.returnedAmount > 0 && (
                    <>
                      <div className="d-flex justify-content-between text-danger">
                        <strong>Returned Amount:</strong>
                        <strong>- Rs. {selectedSale.returnedAmount.toFixed(2)}</strong>
                      </div>
                      <hr />
                      <div className="d-flex justify-content-between text-success">
                        <strong>Net Total:</strong>
                        <strong>Rs. {(selectedSale.total - selectedSale.returnedAmount).toFixed(2)}</strong>
                      </div>
                    </>
                  )}
                </Col>
              </Row>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDetailDialog}>
            Close
          </Button>
          {selectedSale && (selectedSale.status === 'completed' || selectedSale.status === 'partially_returned') && (
            <Button variant="warning" onClick={handleOpenReturnDialog}>
              {selectedSale.status === 'partially_returned' ? 'Process Additional Return' : 'Process Return'}
            </Button>
          )}
          {selectedSale && (
            <Button 
              variant="primary" 
              onClick={() => handlePrintReceipt(String(selectedSale.id))}
              disabled={printingReceipt}
            >
              {printingReceipt ? <Spinner animation="border" size="sm" /> : 'Print Receipt'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Return Dialog Modal */}
      <Modal show={returnDialogOpen} onHide={handleCloseReturnDialog} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Process Return</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Return Type Selector */}
          <Form.Group className="mb-3">
            <Form.Label>Return Type</Form.Label>
            <div>
              <Form.Check
                type="radio"
                id="return-full"
                label="Full Return (Return entire sale)"
                checked={returnType === 'full'}
                onChange={() => setReturnType('full')}
                inline
              />
              <Form.Check
                type="radio"
                id="return-partial"
                label="Partial Return (Select items to return)"
                checked={returnType === 'partial'}
                onChange={() => setReturnType('partial')}
                inline
              />
            </div>
          </Form.Group>

          {/* Item Selection for Partial Return */}
          {returnType === 'partial' && selectedSale?.SaleItems && (
            <div className="mb-3">
              <Form.Label>Select Items to Return</Form.Label>
              <Table size="sm" bordered hover>
                <thead className="table-light">
                  <tr>
                    <th>Item</th>
                    <th style={{ width: '120px' }} className="text-center">Original Qty</th>
                    <th style={{ width: '120px' }} className="text-center">Returned Qty</th>
                    <th style={{ width: '120px' }} className="text-center">Available</th>
                    <th style={{ width: '150px' }} className="text-center">Return Now</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.SaleItems.map((item, index) => {
                    const itemId = item._id || item.id || `item-${index}`;
                    const productName = item.Product?.name || item.product?.name || item.name || 'Unknown Item';
                    const returnedQty = item.returnedQuantity || 0;
                    const availableToReturn = item.quantity - returnedQty;
                    const currentReturnQty = itemsToReturn[itemId] || 0;
                    
                    // Skip items that are fully returned
                    if (availableToReturn <= 0) return null;
                    
                    return (
                      <tr key={itemId}>
                        <td>
                          <strong>{productName}</strong>
                        </td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-center">
                          {returnedQty > 0 ? (
                            <Badge bg="warning">{returnedQty}</Badge>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="text-center">
                          <Badge bg="info">{availableToReturn}</Badge>
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            size="sm"
                            min={0}
                            max={availableToReturn}
                            value={currentReturnQty}
                            onChange={(e) => handleItemReturnQuantityChange(
                              itemId,
                              parseInt(e.target.value) || 0,
                              availableToReturn
                            )}
                            className={currentReturnQty > 0 ? 'border-warning' : ''}
                            placeholder={`Max: ${availableToReturn}`}
                          />
                          {currentReturnQty > availableToReturn && (
                            <small className="text-danger d-block mt-1">
                              Cannot exceed {availableToReturn}
                            </small>
                          )}
                        </td>
                      </tr>
                    );
                  }).filter(Boolean)}
                </tbody>
              </Table>
              <div className="alert alert-info mb-0">
                <small>
                  <strong>Tip:</strong> Enter the quantity to return for each item. The maximum allowed is shown in the "Available" column.
                </small>
              </div>
            </div>
          )}

          {/* Return Reason */}
          <Form.Group>
            <Form.Label>Return Reason</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Enter reason for return..."
              required
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseReturnDialog}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleProcessReturn}
            disabled={processingReturn || !returnReason.trim()}
          >
            {processingReturn ? <Spinner animation="border" size="sm" /> : 'Process Return'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Error/Success Messages */}
      {error && (
        <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1050 }}>
          <div className="alert alert-danger alert-dismissible" role="alert">
            {error}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setError(null)}
            ></button>
          </div>
        </div>
      )}
      
      {successMessage && (
        <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1050 }}>
          <div className="alert alert-success alert-dismissible" role="alert">
            {successMessage}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setSuccessMessage(null)}
            ></button>
          </div>
        </div>
      )}
    </Container>
  );
};

export default Sales;