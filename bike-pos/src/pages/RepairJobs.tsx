import React, { useEffect, useState } from 'react';
import ReactDOMServer from 'react-dom/server';
import ReceiptHtml from '../components/ReceiptHtml';
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
  Table,
  Tabs,
  Tab,
  Alert,
  ProgressBar
} from 'react-bootstrap';
import {
  Plus,
  Search,
  Eye,
  PencilSquare,
  Trash,
  Tools,
  Clock,
  CheckCircle,
  XCircle,
  CurrencyDollar,
  Person,
  Telephone,
  Calendar,
  Wrench
} from 'react-bootstrap-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { repairJobsApi} from '../services/api';
import { productsApi } from '../services/api';


interface RepairJob {
  _id: string;
  jobNumber: string;
  jobType?: 'quick_service' | 'repair_job';
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  item?: {
    brand?: string;
    model?: string;
    year?: string;
    color?: string;
    serialNumber?: string;
    type?: string;
  };
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'billed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedCost: number;
  estimatedCompletionDate?: string;
  actualCompletionDate?: string;
  parts: Array<{
    _id: string;
    product?: any;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    addedAt: string;
  }>;
  labor: Array<{
    _id: string;
    description: string;
    hours: number;
    hourlyRate: number;
    totalCost: number;
    addedAt: string;
  }>;
  services: Array<{
    _id: string;
    repair?: any;
    name: string;
    price: number;
    addedAt: string;
  }>;
  notes: Array<{
    _id: string;
    text: string;
    addedBy: any;
    addedAt: string;
  }>;
  totalCost: number;
  deposit: number;
  remainingBalance: number;
  saleId?: string;
  assignedTo?: any;
  createdBy: any;
  createdAt: string;
  updatedAt: string;
}

const RepairJobs: React.FC = () => {
  const [printingReceipt, setPrintingReceipt] = useState(false);
  // Direct print receipt logic (iframe-based, like POS)
  const directPrintReceipt = async (receiptToPrint: any) => {
    try {
      setPrintingReceipt(true);

      const currentShop = user?.shopId ? { name: user.shopId.name } : null;
      const shopName = currentShop?.name || "Shop";
      const shopPhone = user?.shopId?.phone || "";
      const shopAddress = user?.shopId?.address || "";

      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = 'none';
      printIframe.style.background = 'transparent';
      printIframe.style.zIndex = '9999';
      printIframe.setAttribute('id', 'receipt-print-preview');
      document.body.appendChild(printIframe);

      // Defensive: ensure items are safe
      const safeItems = receiptToPrint.items.map((item: any) => ({
        name: item.name || 'Unnamed Item',
        quantity: item.quantity || 1,
        price: typeof item.price === 'number' ? item.price : 0,
        total: typeof item.total === 'number' ? item.total : 0
      }));
      const safeReceipt = { ...receiptToPrint, items: safeItems };

      // Render ReceiptHtml to HTML string for printing
      const receiptHtmlString = ReactDOMServer.renderToStaticMarkup(
        <ReceiptHtml shopName={shopName} shopAddress={shopAddress} shopPhone={shopPhone} receiptData={safeReceipt} />
      );
      const printCss = `<style>
        @media print {
          body { margin: 0; }
        }
        body { background: #fff; margin: 0; padding: 0; }
      </style>`;
      // Only print the receipt content, no extra title or date
      const fullHtml = `<!DOCTYPE html><html><head>${printCss}</head><body>${receiptHtmlString}</body></html>`;

      const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(fullHtml);
        iframeDoc.close();

        // Immediately trigger print, no preview
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(printIframe)) {
              document.body.removeChild(printIframe);
              setPrintingReceipt(false);
            }
          }, 2000);
        } catch (err) {
          console.error('Error during iframe print:', err);
          document.body.removeChild(printIframe);
          setPrintingReceipt(false);
        }
      } else {
        throw new Error('Could not access iframe document');
      }
    } catch (error) {
      console.error('Error printing receipt:', error);
      setPrintingReceipt(false);
    }
  };
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  
  // State management
  const [repairJobs, setRepairJobs] = useState<RepairJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<RepairJob | null>(null);
  // Remove receipt modal state
  // Print preview logic will be used instead
  
  // Form states
  const [formData, setFormData] = useState({
    customer: {
      name: '',
      phone: '',
      email: ''
    },
    item: {
      brand: '',
      model: '',
      year: '',
      color: '',
      serialNumber: '',
      type: ''
    },
    description: '',
    priority: 'medium' as const,
    estimatedCost: '',
    estimatedCompletionDate: '',
    deposit: ''
  });

  // Load repair jobs
  const fetchRepairJobs = async () => {
    try {
      setLoading(true);
      const response = await repairJobsApi.getAll({
        page,
        limit: 10,
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined
      });

      // Filter out quick services (jobType: 'quick_service')
      const filteredJobs = (response.data.repairJobs || []).filter(
        (job: RepairJob) => job.jobType !== 'quick_service'
      );
      setRepairJobs(filteredJobs);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error: any) {
      console.error('Error fetching repair jobs:', error);
      showError('Failed to load repair jobs');
      setRepairJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepairJobs();
  }, [page, searchQuery, statusFilter, priorityFilter]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const jobData = {
        customer: formData.customer,
        item: formData.item,
        description: formData.description,
        priority: formData.priority,
        estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : 0,
        estimatedCompletionDate: formData.estimatedCompletionDate || undefined,
        deposit: formData.deposit ? parseFloat(formData.deposit) : 0
      };

      await repairJobsApi.create(jobData);
      showSuccess('Repair job created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchRepairJobs();
    } catch (error: any) {
      console.error('Error creating repair job:', error);
      showError('Failed to create repair job');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      customer: { name: '', phone: '', email: '' },
      item: { brand: '', model: '', year: '', color: '', serialNumber: '', type: '' },
      description: '',
      priority: 'medium',
      estimatedCost: '',
      estimatedCompletionDate: '',
      deposit: ''
    });
  };

  // Handle status update
  const handleStatusUpdate = async (jobId: string, newStatus: string) => {
    try {
      await repairJobsApi.update(jobId, { status: newStatus });
      showSuccess('Status updated successfully');
      fetchRepairJobs();
    } catch (error: any) {
      console.error('Error updating status:', error);
      showError('Failed to update status');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedJob) return;

    try {
      await repairJobsApi.delete(selectedJob._id);
      showSuccess('Repair job deleted successfully');
      setShowDeleteModal(false);
      setSelectedJob(null);
      fetchRepairJobs();
    } catch (error: any) {
      console.error('Error deleting repair job:', error);
      showError('Failed to delete repair job');
    }
  };

  // Handle convert to sale
  const handleConvertToSale = async (jobId: string) => {
    try {
      const res = await repairJobsApi.convertToSale(jobId, { paymentMethod: 'cash' });
      showSuccess('Repair job converted to sale successfully');
      fetchRepairJobs();
      // Prepare receipt data for direct print
      const job = selectedJob;
      const sale = res.data.sale;
      const receiptServices = res.data.receiptServices || [];
      const receiptToPrint = {
        date: '',
        invoiceNumber: sale?.invoiceNumber || '',
        customer: job?.customer?.name || '',
        cashier: user?.name || user?.username || '',
        items: [
          ...(job?.parts?.map((part: any) => ({
            name: part.name,
            quantity: part.quantity,
            price: part.unitPrice,
            total: part.totalPrice
          })) || []),
          ...(receiptServices?.map((service: any) => ({
            name: service.name,
            quantity: service.quantity,
            price: service.price,
            total: service.price * service.quantity
          })) || [])
        ],
        subtotal: sale?.subtotal || 0,
        servicesSubtotal: sale?.servicesSubtotal || 0,
        discount: sale?.discount || 0,
        tax: sale?.tax || 0,
        total: sale?.total || 0,
        paymentMethod: sale?.paymentMethod || 'cash'
      };
      await directPrintReceipt(receiptToPrint);
    } catch (error: any) {
      console.error('Error converting to sale:', error);
      showError('Failed to convert to sale');
    }
  };

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'warning',
      in_progress: 'info',
      completed: 'success',
      billed: 'primary',
      cancelled: 'danger'
    };
    return variants[status as keyof typeof variants] || 'secondary';
  };

  // Get priority badge variant
  const getPriorityBadge = (priority: string) => {
    const variants = {
      low: 'success',
      medium: 'warning',
      high: 'danger',
      urgent: 'dark'
    };
    return variants[priority as keyof typeof variants] || 'secondary';
  };

  return (
    <Container fluid className="py-4">
      {/* Header */}
      <Row className="mb-4 align-items-center">
        <Col>
          <h4 className="fw-bold mb-0 d-flex align-items-center">
            <Tools className="me-2" />
            Repair Jobs
          </h4>
          <p className="text-muted mb-0">Manage repair jobs and track progress</p>
        </Col>
        <Col xs="auto">
          <Button 
            variant="primary" 
            onClick={() => setShowCreateModal(true)}
            className="d-flex align-items-center"
          >
            <Plus className="me-1" />
            New Repair Job
          </Button>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text>
                  <Search />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search jobs, customers, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="billed">Billed</option>
                <option value="cancelled">Cancelled</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="all">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Jobs Table */}
      <Card>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light">
                <tr>
                  <th>Job #</th>
                  <th>Customer</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Total Cost</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4">
                      <Spinner animation="border" />
                    </td>
                  </tr>
                ) : repairJobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4">
                      No repair jobs found
                    </td>
                  </tr>
                ) : (
                  repairJobs.map((job) => (
                    <tr key={job._id}>
                      <td>
                        <strong>{job.jobNumber}</strong>
                      </td>
                      <td>
                        <div>
                          <strong>{job.customer.name}</strong>
                          <br />
                          <small className="text-muted">{job.customer.phone}</small>
                        </div>
                      </td>
                      <td>
                        <div style={{ maxWidth: '200px' }}>
                          {job.description.length > 50 
                            ? `${job.description.substring(0, 50)}...`
                            : job.description
                          }
                        </div>
                      </td>
                      <td>
                        <Badge bg={getStatusBadge(job.status)}>
                          {job.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </td>
                      <td>
                        <Badge bg={getPriorityBadge(job.priority)}>
                          {job.priority.toUpperCase()}
                        </Badge>
                      </td>
                      <td>
                        <strong>Rs. {job.totalCost.toFixed(2)}</strong>
                        {job.deposit > 0 && (
                          <div>
                            <small className="text-muted">
                              Deposit: Rs. {job.deposit.toFixed(2)}
                            </small>
                          </div>
                        )}
                      </td>
                      <td>
                        <small>
                          {new Date(job.createdAt).toLocaleDateString()}
                        </small>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              setSelectedJob(job);
                              setShowDetailsModal(true);
                            }}
                          >
                            <Eye size={14} />
                          </Button>
                          
                          {job.status === 'completed' && !job.saleId && (
                            <Button
                              variant="outline-success"
                              size="sm"
                              onClick={() => handleConvertToSale(job._id)}
                              title="Convert to Sale"
                            >
                              <CurrencyDollar size={14} />
                            </Button>
                          )}
                          
                          {job.status !== 'billed' && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => {
                                setSelectedJob(job);
                                setShowDeleteModal(true);
                              }}
                            >
                              <Trash size={14} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Create Job Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Create New Repair Job</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Tabs defaultActiveKey="customer" className="mb-3">
              <Tab eventKey="customer" title="Customer Info">
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Customer Name *</Form.Label>
                      <Form.Control
                        type="text"
                        required
                        value={formData.customer.name}
                        onChange={(e) => setFormData({
                          ...formData,
                          customer: { ...formData.customer, name: e.target.value }
                        })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Phone Number *</Form.Label>
                      <Form.Control
                        type="tel"
                        required
                        value={formData.customer.phone}
                        onChange={(e) => setFormData({
                          ...formData,
                          customer: { ...formData.customer, phone: e.target.value }
                        })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Email (Optional)</Form.Label>
                      <Form.Control
                        type="email"
                        value={formData.customer.email}
                        onChange={(e) => setFormData({
                          ...formData,
                          customer: { ...formData.customer, email: e.target.value }
                        })}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Tab>
              
              <Tab eventKey="item" title="Item Details">
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Type</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="e.g., Bike, Motorcycle, Electronics"
                        value={formData.item.type}
                        onChange={(e) => setFormData({
                          ...formData,
                          item: { ...formData.item, type: e.target.value }
                        })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Brand</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.item.brand}
                        onChange={(e) => setFormData({
                          ...formData,
                          item: { ...formData.item, brand: e.target.value }
                        })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Model</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.item.model}
                        onChange={(e) => setFormData({
                          ...formData,
                          item: { ...formData.item, model: e.target.value }
                        })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Year</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.item.year}
                        onChange={(e) => setFormData({
                          ...formData,
                          item: { ...formData.item, year: e.target.value }
                        })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Color</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.item.color}
                        onChange={(e) => setFormData({
                          ...formData,
                          item: { ...formData.item, color: e.target.value }
                        })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Serial Number</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.item.serialNumber}
                        onChange={(e) => setFormData({
                          ...formData,
                          item: { ...formData.item, serialNumber: e.target.value }
                        })}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Tab>
              
              <Tab eventKey="job" title="Job Details">
                <Row className="g-3">
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Problem Description *</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({
                          ...formData,
                          description: e.target.value
                        })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Priority</Form.Label>
                      <Form.Select
                        value={formData.priority}
                        onChange={(e) => setFormData({
                          ...formData,
                          priority: e.target.value as any
                        })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Estimated Cost</Form.Label>
                      <InputGroup>
                        <InputGroup.Text>Rs.</InputGroup.Text>
                        <Form.Control
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.estimatedCost}
                          onChange={(e) => setFormData({
                            ...formData,
                            estimatedCost: e.target.value
                          })}
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Estimated Completion</Form.Label>
                      <Form.Control
                        type="date"
                        value={formData.estimatedCompletionDate}
                        onChange={(e) => setFormData({
                          ...formData,
                          estimatedCompletionDate: e.target.value
                        })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Deposit</Form.Label>
                      <InputGroup>
                        <InputGroup.Text>Rs.</InputGroup.Text>
                        <Form.Control
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.deposit}
                          onChange={(e) => setFormData({
                            ...formData,
                            deposit: e.target.value
                          })}
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                </Row>
              </Tab>
            </Tabs>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create Job
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Job Details Modal */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            Repair Job Details - {selectedJob?.jobNumber}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedJob && (
            <Row>
              <Col md={8}>
                {/* Job Info */}
                <Card className="mb-3">
                  <Card.Header>
                    <h6 className="mb-0">Job Information</h6>
                  </Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={6}>
                        <p><strong>Status:</strong> <Badge bg={getStatusBadge(selectedJob.status)}>{selectedJob.status.replace('_', ' ').toUpperCase()}</Badge></p>
                        <p><strong>Priority:</strong> <Badge bg={getPriorityBadge(selectedJob.priority)}>{selectedJob.priority.toUpperCase()}</Badge></p>
                        <p><strong>Description:</strong> {selectedJob.description}</p>
                      </Col>
                      <Col md={6}>
                        <p><strong>Created:</strong> {new Date(selectedJob.createdAt).toLocaleString()}</p>
                        <p><strong>Estimated Cost:</strong> Rs. {selectedJob.estimatedCost.toFixed(2)}</p>
                        <p><strong>Total Cost:</strong> Rs. {selectedJob.totalCost.toFixed(2)}</p>
                        <p><strong>Deposit:</strong> Rs. {selectedJob.deposit.toFixed(2)}</p>
                        <p><strong>Balance:</strong> Rs. {selectedJob.remainingBalance.toFixed(2)}</p>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>

                {/* Parts & Services */}
                <Card className="mb-3">
                  <Card.Header>
                    <h6 className="mb-0">Parts & Services</h6>
                  </Card.Header>
                  <Card.Body>
                    {/* Add Part Form with Products List */}
                    {selectedJob && (
                      <AddPartForm selectedJob={selectedJob} showSuccess={showSuccess} showError={showError} fetchRepairJobs={fetchRepairJobs} />
                    )}
                    {selectedJob.parts.length > 0 && (
                      <div className="mb-3">
                        <h6>Parts:</h6>
                        <Table size="sm">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Qty</th>
                              <th>Unit Price</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedJob.parts.map((part) => (
                              <tr key={part._id}>
                                <td>{part.name}</td>
                                <td>{part.quantity}</td>
                                <td>Rs. {part.unitPrice.toFixed(2)}</td>
                                <td>Rs. {part.totalPrice.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}
                    {/* Add Service Form */}
                    <Form className="mb-3" onSubmit={async (e) => {
                      e.preventDefault();
                      if (!selectedJob) return;
                      const form = e.target as typeof e.target & {
                        serviceName: { value: string };
                        servicePrice: { value: string };
                      };
                      try {
                        await repairJobsApi.addService(selectedJob._id, {
                          name: form.serviceName.value,
                          price: Number(form.servicePrice.value)
                        });
                        showSuccess('Service added');
                        fetchRepairJobs();
                      } catch (err) {
                        showError('Failed to add service');
                      }
                    }}>
                      <Row className="g-2 align-items-end">
                        <Col><Form.Control name="serviceName" placeholder="Service Name" required /></Col>
                        <Col><Form.Control name="servicePrice" type="number" min={0} step="0.01" placeholder="Price" required /></Col>
                        <Col xs="auto"><Button type="submit" size="sm">Add Service</Button></Col>
                      </Row>
                    </Form>
                    {selectedJob.services.length > 0 && (
                      <div className="mb-3">
                        <h6>Services:</h6>
                        <Table size="sm">
                          <thead>
                            <tr>
                              <th>Service</th>
                              <th>Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedJob.services.map((service) => (
                              <tr key={service._id}>
                                <td>{service.name}</td>
                                <td>Rs. {service.price.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}
                    {/* Add Labor Form */}
                    <Form className="mb-3" onSubmit={async (e) => {
                      e.preventDefault();
                      if (!selectedJob) return;
                      const form = e.target as typeof e.target & {
                        laborDesc: { value: string };
                        laborHours: { value: string };
                        laborRate: { value: string };
                      };
                      try {
                        await repairJobsApi.addLabor(selectedJob._id, {
                          description: form.laborDesc.value,
                          hours: Number(form.laborHours.value),
                          hourlyRate: Number(form.laborRate.value)
                        });
                        showSuccess('Labor added');
                        fetchRepairJobs();
                      } catch (err) {
                        showError('Failed to add labor');
                      }
                    }}>
                      <Row className="g-2 align-items-end">
                        <Col><Form.Control name="laborDesc" placeholder="Labor Description" required /></Col>
                        <Col><Form.Control name="laborHours" type="number" min={0.1} step="0.1" placeholder="Hours" required /></Col>
                        <Col><Form.Control name="laborRate" type="number" min={0} step="0.01" placeholder="Hourly Rate" required /></Col>
                        <Col xs="auto"><Button type="submit" size="sm">Add Labor</Button></Col>
                      </Row>
                    </Form>
                    {selectedJob.labor.length > 0 && (
                      <div>
                        <h6>Labor:</h6>
                        <Table size="sm">
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th>Hours</th>
                              <th>Rate</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedJob.labor.map((labor) => (
                              <tr key={labor._id}>
                                <td>{labor.description}</td>
                                <td>{labor.hours}</td>
                                <td>Rs. {labor.hourlyRate.toFixed(2)}</td>
                                <td>Rs. {labor.totalCost.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              <Col md={4}>
                {/* Customer Info */}
                <Card className="mb-3">
                  <Card.Header>
                    <h6 className="mb-0">Customer Information</h6>
                  </Card.Header>
                  <Card.Body>
                    <p><Person className="me-2" /><strong>{selectedJob.customer.name}</strong></p>
                    <p><Telephone className="me-2" />{selectedJob.customer.phone}</p>
                    {selectedJob.customer.email && (
                      <p>📧 {selectedJob.customer.email}</p>
                    )}
                  </Card.Body>
                </Card>

                {/* Item Info */}
                {selectedJob.item && (
                  <Card className="mb-3">
                    <Card.Header>
                      <h6 className="mb-0">Item Information</h6>
                    </Card.Header>
                    <Card.Body>
                      {selectedJob.item.type && <p><strong>Type:</strong> {selectedJob.item.type}</p>}
                      {selectedJob.item.brand && <p><strong>Brand:</strong> {selectedJob.item.brand}</p>}
                      {selectedJob.item.model && <p><strong>Model:</strong> {selectedJob.item.model}</p>}
                      {selectedJob.item.year && <p><strong>Year:</strong> {selectedJob.item.year}</p>}
                      {selectedJob.item.color && <p><strong>Color:</strong> {selectedJob.item.color}</p>}
                      {selectedJob.item.serialNumber && <p><strong>Serial:</strong> {selectedJob.item.serialNumber}</p>}
                    </Card.Body>
                  </Card>
                )}

                {/* Status Actions */}
                <Card>
                  <Card.Header>
                    <h6 className="mb-0">Actions</h6>
                  </Card.Header>
                  <Card.Body>
                    <div className="d-grid gap-2">
                      {selectedJob.status === 'pending' && (
                        <Button
                          variant="info"
                          onClick={() => handleStatusUpdate(selectedJob._id, 'in_progress')}
                        >
                          Start Work
                        </Button>
                      )}
                      {selectedJob.status === 'in_progress' && (
                        <Button
                          variant="success"
                          onClick={() => handleStatusUpdate(selectedJob._id, 'completed')}
                        >
                          Mark Complete
                        </Button>
                      )}
                      {/* Print Bill button for completed jobs not yet billed */}
                      {selectedJob.status === 'completed' && !selectedJob.saleId && (
                        <Button
                          variant="primary"
                          onClick={async () => {
                            await handleConvertToSale(selectedJob._id);
                          }}
                        >
                          Print Bill
                        </Button>
                      )}
                      {selectedJob.saleId && (
                        <Alert variant="success" className="mb-0">
                          <CheckCircle className="me-2" />
                          Job has been billed
                        </Alert>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
        </Modal.Body>
      </Modal>

      {/* Receipt Modal removed. Print preview is now used for bill printing. */}

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Delete Repair Job</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete repair job <strong>{selectedJob?.jobNumber}</strong>?</p>
          <p className="text-danger">This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

/**
 * AddPartForm component for adding parts to a repair job.
 */
interface AddPartFormProps {
  selectedJob: RepairJob;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
  fetchRepairJobs: () => void;
}




const AddPartForm: React.FC<AddPartFormProps> = ({ selectedJob, showSuccess, showError, fetchRepairJobs }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [stock, setStock] = useState<number | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await productsApi.getAll();
        setProducts(res.data.products || []);
        setFilteredProducts(res.data.products || []);
      } catch (err) {
        setProducts([]);
        setFilteredProducts([]);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (search.trim()) {
      setFilteredProducts(products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.includes(search)));
    } else {
      setFilteredProducts(products);
    }
  }, [search, products]);

  useEffect(() => {
    if (selectedProductId) {
      const prod = products.find(p => p._id === selectedProductId);
      if (prod) {
        setUnitPrice(prod.price);
        setStock(prod.quantity ?? prod.stockQuantity ?? null);
      }
    } else {
      setUnitPrice('');
      setStock(null);
    }
  }, [selectedProductId, products]);

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !quantity || !unitPrice) return;
    const prod = products.find(p => p._id === selectedProductId);
    try {
      await repairJobsApi.addPart(selectedJob._id, {
        productId: selectedProductId,
        name: prod?.name || '',
        quantity: Number(quantity),
        unitPrice: Number(unitPrice)
      });
      showSuccess('Part added');
      // Refetch products to update stock
      const res = await productsApi.getAll();
      setProducts(res.data.products || []);
      setFilteredProducts(res.data.products || []);
      setSelectedProductId('');
      setQuantity(1);
      setUnitPrice('');
      setSearch('');
      setStock(null);
      fetchRepairJobs();
    } catch (err) {
      showError('Failed to add part');
    }
  };

  return (
    <Form className="mb-3" onSubmit={handleAddPart}>
      <Row className="g-2 align-items-end">
        <Col md={4}>
          <Form.Control
            type="text"
            placeholder="Search product..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </Col>
        <Col md={4}>
          <Form.Select
            value={selectedProductId}
            onChange={e => setSelectedProductId(e.target.value)}
            required
          >
            <option value="">Select Product</option>
            {filteredProducts.map(product => (
              <option key={product._id} value={product._id}>{product.name} {product.sku ? `(${product.sku})` : ''}</option>
            ))}
          </Form.Select>
          {stock !== null && (
            <div className="text-muted small">Stock: {stock}</div>
          )}
        </Col>
        <Col md={2}>
          <Form.Control
            name="partQty"
            type="number"
            min={1}
            value={quantity}
            onChange={e => setQuantity(Number(e.target.value))}
            placeholder="Qty"
            required
          />
        </Col>
        <Col md={2}>
          <Form.Control
            name="partUnitPrice"
            type="number"
            min={0}
            step="0.01"
            value={unitPrice}
            onChange={e => setUnitPrice(Number(e.target.value))}
            placeholder="Unit Price"
            required
          />
        </Col>
        <Col xs="auto"><Button type="submit" size="sm">Add Part</Button></Col>
      </Row>
    </Form>
  );
};

export default RepairJobs;
