import React, { useState, useEffect } from "react";
import { Spinner, Row, Col, Container, Card, Button, Form } from "react-bootstrap";
import { Bank2, PlusCircle, ArrowLeft, Save } from "react-bootstrap-icons";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const AccountForm = () => {
  const [formData, setFormData] = useState({
    accountNumber: "",
    accountType: "SAVINGS",
    balance: 0,
    customerId: "",
    interestRate: 0.02,
    status: "ACTIVE",
  });
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    fetchCustomers();
    if (id) {
      setIsEdit(true);
      fetchAccount(id);
    }
  }, [id]);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/customers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setCustomers(response.data);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomers([]);
    }
  };

  const fetchAccount = async (accountId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/accounts/${accountId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setFormData(response.data);
    } catch (error) {
      console.error("Error fetching account:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error("Unauthorized. Please log in again.");
        navigate("/trading");
      } else {
        toast.error("Failed to fetch account data");
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
      const accountData = {
        ...formData,
        balance: parseFloat(formData.balance),
        interestRate: parseFloat(formData.interestRate),
        customerId: parseInt(formData.customerId),
      };

      const token = localStorage.getItem("token");
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      if (isEdit) {
        await axios.put(`${API_BASE_URL}/accounts/${id}`, accountData, { headers });
        toast.success("Account updated successfully");
      } else {
        await axios.post(`${API_BASE_URL}/accounts`, accountData, { headers });
        toast.success("Account created successfully");
      }
      navigate("/accounts");
    } catch (error) {
      console.error("Error saving account:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error("Unauthorized. Please log in again.");
        navigate("/trading");
      } else {
        toast.error(`Failed to ${isEdit ? "update" : "create"} account`);
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
              <Bank2 size={32} color="var(--primary-blue)" />
            ) : (
              <PlusCircle size={32} color="var(--primary-blue)" />
            )}
            <h1 className="mb-0" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
              {isEdit ? "Edit Account" : "Open New Account"}
            </h1>
          </div>
          <p className="text-muted mb-0" style={{ paddingLeft: "2.75rem", color: "var(--text-tertiary)" }}>
            {isEdit ? "Update account information" : "Create a new bank account"}
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
                    Account Number <span style={{ color: "#dc3545" }}>*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="accountNumber"
                    value={formData.accountNumber}
                    onChange={handleChange}
                    required
                    disabled={isEdit}
                    style={{
                      borderRadius: "var(--radius-md)",
                      borderColor: "var(--border-medium)",
                      background: isEdit ? "var(--bg-secondary)" : "var(--bg-input)",
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    Account Type <span style={{ color: "#dc3545" }}>*</span>
                  </Form.Label>
                  <Form.Select
                    name="accountType"
                    value={formData.accountType}
                    onChange={handleChange}
                    required
                    style={{
                      borderRadius: "var(--radius-md)",
                      borderColor: "var(--border-medium)",
                      background: "var(--bg-input)",
                    }}
                  >
                    <option value="SAVINGS">Savings</option>
                    <option value="CHECKING">Checking</option>
                    <option value="FIXED_DEPOSIT">Fixed Deposit</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    Customer <span style={{ color: "#dc3545" }}>*</span>
                  </Form.Label>
                  <Form.Select
                    name="customerId"
                    value={formData.customerId}
                    onChange={handleChange}
                    required
                    disabled={isEdit}
                    style={{
                      borderRadius: "var(--radius-md)",
                      borderColor: "var(--border-medium)",
                      background: isEdit ? "var(--bg-secondary)" : "var(--bg-input)",
                    }}
                  >
                    <option value="">Select a customer</option>
                    {customers.map((customer) => (
                      <option
                        key={customer.customerId}
                        value={customer.customerId}
                      >
                        {customer.firstName} {customer.lastName}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    Initial Balance
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    name="balance"
                    value={formData.balance}
                    onChange={handleChange}
                    disabled={isEdit}
                    style={{
                      borderRadius: "var(--radius-md)",
                      borderColor: "var(--border-medium)",
                      background: isEdit ? "var(--bg-secondary)" : "var(--bg-input)",
                    }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    Interest Rate (%)
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    name="interestRate"
                    value={formData.interestRate}
                    onChange={handleChange}
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
                    Account Status
                  </Form.Label>
                  <Form.Select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    style={{
                      borderRadius: "var(--radius-md)",
                      borderColor: "var(--border-medium)",
                      background: "var(--bg-input)",
                    }}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                  </Form.Select>
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
                    {isEdit ? "Update Account" : "Create Account"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline-secondary"
                onClick={() => navigate("/accounts")}
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

export default AccountForm;
