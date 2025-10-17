import React, { useState, useEffect } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
  Spinner
} from 'react-bootstrap';
import { Gear, Building, Telephone, GeoAlt, Clock } from 'react-bootstrap-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

interface ShopData {
  _id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  taxRate: number;
  currency: string;
}

const ShopSettings: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopData, setShopData] = useState<ShopData | null>(null);

  useEffect(() => {
    fetchShopData();
  }, []);

  const fetchShopData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await shopsApi.getCurrent();
      // setShopData(response.data);
      
      // Mock data for now
      setShopData({
        _id: user?.shopId?._id || '1',
        name: user?.shopId?.name || 'My Shop',
        address: '123 Main Street, City, State 12345',
        phone: '+1 (555) 123-4567',
        email: 'shop@example.com',
        taxRate: 0.08,
        currency: 'USD'
      });
    } catch (error) {
      console.error('Error fetching shop data:', error);
      showError('Failed to load shop settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopData) return;

    try {
      setSaving(true);
      // TODO: Replace with actual API call
      // await shopsApi.update(shopData._id, shopData);
      showSuccess('Shop settings updated successfully');
    } catch (error) {
      console.error('Error saving shop data:', error);
      showError('Failed to save shop settings');
    } finally {
      setSaving(false);
    }
  };

  const updateShopData = (field: string, value: any) => {
    if (!shopData) return;
    setShopData({ ...shopData, [field]: value });
  };


  if (loading) {
    return (
      <Container fluid className="py-4">
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </Container>
    );
  }

  if (!shopData) {
    return (
      <Container fluid className="py-4">
        <Alert variant="danger">
          Failed to load shop settings. Please try again.
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <h4 className="fw-bold mb-0 d-flex align-items-center">
            <Gear className="me-2" />
            Shop Settings
          </h4>
          <p className="text-muted mb-0">Manage your shop information and preferences</p>
        </Col>
      </Row>

      <Form onSubmit={handleSave}>
        <Row>
          {/* Basic Information */}
          <Col  className="mb-4">
            <Card>
              <Card.Header>
                <h6 className="mb-0 d-flex align-items-center">
                  <Building className="me-2" />
                  Basic Information
                </h6>
              </Card.Header>
              <Card.Body>
                <Row className="g-3">
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Shop Name</Form.Label>
                      <Form.Control
                        type="text"
                        value={shopData.name}
                        onChange={(e) => updateShopData('name', e.target.value)}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Address</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={shopData.address}
                        onChange={(e) => updateShopData('address', e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Phone</Form.Label>
                      <Form.Control
                        type="tel"
                        value={shopData.phone}
                        onChange={(e) => updateShopData('phone', e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        value={shopData.email}
                        onChange={(e) => updateShopData('email', e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>

        
        </Row>


        {/* Save Button */}
        <Row>
          <Col>
            <div className="d-flex justify-content-end">
              <Button
                type="submit"
                variant="primary"
                disabled={saving}
                className="px-4"
              >
                {saving ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </Button>
            </div>
          </Col>
        </Row>
      </Form>
    </Container>
  );
};

export default ShopSettings;
