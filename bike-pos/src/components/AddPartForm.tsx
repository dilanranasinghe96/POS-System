import React, { useEffect, useState } from 'react';
import { Form, Row, Col, Button } from 'react-bootstrap';
import { productsApi, repairJobsApi } from '../services/api';

interface AddPartFormProps {
  selectedJob: any;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
  fetchRepairJobs: () => void;
}

const AddPartForm: React.FC<AddPartFormProps> = ({ selectedJob, showSuccess, showError, fetchRepairJobs }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number | ''>('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await productsApi.getAll();
        setProducts(res.data.products || []);
      } catch (err) {
        setProducts([]);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      const prod = products.find(p => p._id === selectedProductId);
      if (prod) setUnitPrice(prod.price);
    } else {
      setUnitPrice('');
    }
  }, [selectedProductId, products]);

  const handleSubmit = async (e: React.FormEvent) => {
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
      setSelectedProductId('');
      setQuantity(1);
      setUnitPrice('');
      fetchRepairJobs();
    } catch (err) {
      showError('Failed to add part');
    }
  };

  return (
    <Form className="mb-3" onSubmit={handleSubmit}>
      <Row className="g-2 align-items-end">
        <Col>
          <Form.Select name="product" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} required>
            <option value="">Select Product</option>
            {products.map(product => (
              <option key={product._id} value={product._id}>{product.name}</option>
            ))}
          </Form.Select>
        </Col>
        <Col>
          <Form.Control name="partQty" type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} placeholder="Qty" required />
        </Col>
        <Col>
          <Form.Control name="partUnitPrice" type="number" min={0} step="0.01" value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))} placeholder="Unit Price" required />
        </Col>
        <Col xs="auto"><Button type="submit" size="sm">Add Part</Button></Col>
      </Row>
    </Form>
  );
};

export default AddPartForm;