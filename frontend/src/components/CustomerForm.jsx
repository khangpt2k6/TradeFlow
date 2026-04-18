import React, { useState, useEffect } from "react";
import { Spinner, Row, Col, Container, Card, Button, Form } from "react-bootstrap";
import { PersonPlus, PersonCheck, ArrowLeft, Save } from "react-bootstrap-icons";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const CustomerForm = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    dateOfBirth: "",
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (id) {
      setIsEdit(true);
      fetchCustomer(id);
    }
  }, [id]);

  const fetchCustomer = async (customerId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/customers/${customerId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setFormData(response.data);
    } catch (error) {
      console.error("Error fetching customer:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error("Unauthorized. Please log in again.");
        navigate("/trading");
      } else {
        toast.error("Failed to fetch customer data");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      if (isEdit) {
        await axios.put(`${API_BASE_URL}/customers/${id}`, formData, { headers });
        toast.success("Customer updated successfully");
      } else {
        await axios.post(`${API_BASE_URL}/customers`, formData, { headers });
        toast.success("Customer created successfully");
      }
      navigate("/customers");
    } catch (error) {
      console.error("Error saving customer:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error("Unauthorized. Please log in again.");
        navigate("/trading");
      } else {
        toast.error(`Failed to ${isEdit ? "update" : "create"} customer`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return (
      <Container fluid className="py-5" style={{ maxWidth: "900px" }}>
        <div className="text-center py-5">
          <Spinner animation="border" role="status" style={{ color: "var(--primary-blue)" }}>
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4" style={{ maxWidth: "900px", background: "var(--gradient-background)", minHeight: "100vh" }}>
      {/* Header */}
      <Row className="mb-5">
        <Col>
          <div className="d-flex align-items-center gap-3 mb-2">
            {isEdit ? (
              <PersonCheck size={32} color="var(--primary-blue)" />
            ) : (
              <PersonPlus size={32} color="var(--primary-blue)" />
            )}
            <h1 className="mb-0" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
              {isEdit ? "Edit Customer" : "Add New Customer"}
            </h1>
          </div>
          <p className="text-muted mb-0" style={{ paddingLeft: "2.75rem", color: "var(--text-tertiary)" }}>
            {isEdit ? "Update customer information" : "Create a new customer account"}
          </p>
        </Col>
      </Row>

      {/* Form Card */}
      <Card className="border-0 shadow-sm" style={{ background: "#ffffff", borderRadius: "var(--radius-lg)", boxShadow: "0 18px 38px rgba(16, 42, 67, 0.08)" }}>
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    First Name <span style={{ color: "#dc3545" }}>*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    style={{
                      borderRadius: "var(--radius-md)",
                      borderColor: "var(--border-medium)",
                      background: "var(--bg-input)",
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    Last Name <span style={{ color: "#dc3545" }}>*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    style={{
                      borderRadius: "var(--radius-md)",
                      borderColor: "var(--border-medium)",
                      background: "var(--bg-input)",
                    }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    Email <span style={{ color: "#dc3545" }}>*</span>
                  </Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    style={{
                      borderRadius: "var(--radius-md)",
                      borderColor: "var(--border-medium)",
                      background: "var(--bg-input)",
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    Phone
                  </Form.Label>
                  <Form.Control
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    style={{
                      borderRadius: "var(--radius-md)",
                      borderColor: "var(--border-medium)",
                      background: "var(--bg-input)",
                    }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                Address <span style={{ color: "#dc3545" }}>*</span>
              </Form.Label>
              <Form.Control
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                style={{
                  borderRadius: "var(--radius-md)",
                  borderColor: "var(--border-medium)",
                  background: "var(--bg-input)",
                }}
              />
            </Form.Group>

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    Date of Birth
                  </Form.Label>
                  <Form.Control
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    max={new Date().toISOString().split("T")[0]}
                    style={{
                      borderRadius: "var(--radius-md)",
                      borderColor: "var(--border-medium)",
                      background: "var(--bg-input)",
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={6} className="d-flex align-items-end">
                <Form.Group className="mb-0 w-100">
                  <Form.Check
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    label="Active Customer"
                    style={{
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      paddingTop: "2rem",
                    }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <div className="d-flex gap-3 mt-4 pt-3 border-top" style={{ borderColor: "var(--border-light) !important" }}>
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="d-inline-flex align-items-center gap-2"
                style={{
                  borderRadius: "var(--radius-full)",
                  fontWeight: 600,
                  padding: "0.75rem 2rem",
                  border: "none",
                }}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    {isEdit ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    {isEdit ? "Update Customer" : "Create Customer"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline-secondary"
                onClick={() => navigate("/customers")}
                className="d-inline-flex align-items-center gap-2"
                style={{
                  borderRadius: "var(--radius-full)",
                  fontWeight: 600,
                  padding: "0.75rem 2rem",
                  borderColor: "var(--border-medium)",
                }}
              >
                <ArrowLeft size={18} />
                Cancel
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default CustomerForm;
