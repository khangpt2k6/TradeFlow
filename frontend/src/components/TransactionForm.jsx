import React, { useState, useEffect } from "react";
import { Spinner, Row, Col, Container, Card, Button, Form } from "react-bootstrap";
import { ArrowLeftRight, PlusCircle, ArrowLeft, Save } from "react-bootstrap-icons";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const TransactionForm = () => {
  const [formData, setFormData] = useState({
    transactionType: "DEPOSIT",
    amount: 0,
    accountId: "",
    destinationAccountId: "",
    description: "",
  });
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    fetchAccounts();
    if (id) {
      setIsEdit(true);
      fetchTransaction(id);
    }
  }, [id]);

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/accounts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      let accountsData = [];
      if (Array.isArray(response.data)) {
        accountsData = response.data;
      } else if (response.data && response.data.accounts && Array.isArray(response.data.accounts)) {
        accountsData = response.data.accounts;
      }
      setAccounts(accountsData);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      setAccounts([]);
    }
  };

  const fetchTransaction = async (transactionId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/transactions/${transactionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setFormData(response.data);
    } catch (error) {
      console.error("Error fetching transaction:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error("Unauthorized. Please log in again.");
        navigate("/trading");
      } else {
        toast.error("Failed to fetch transaction data");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newFormData = {
        ...prev,
        [name]: value,
      };

      if (name === "transactionType" && value !== "TRANSFER") {
        newFormData.destinationAccountId = "";
      }

      return newFormData;
    });
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
        await axios.put(`${API_BASE_URL}/transactions/${id}`, formData, { headers });
        toast.success("Transaction updated successfully");
      } else {
        await axios.post(`${API_BASE_URL}/transactions`, formData, { headers });
        toast.success("Transaction created successfully");
      }
      navigate("/transactions");
    } catch (error) {
      console.error("Error saving transaction:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error("Unauthorized. Please log in again.");
        navigate("/trading");
      } else {
        toast.error(`Failed to ${isEdit ? "update" : "create"} transaction`);
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
              <ArrowLeftRight size={32} color="var(--primary-blue)" />
            ) : (
              <PlusCircle size={32} color="var(--primary-blue)" />
            )}
            <h1 className="mb-0" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
              {isEdit ? "Edit Transaction" : "New Transaction"}
            </h1>
          </div>
          <p className="text-muted mb-0" style={{ paddingLeft: "2.75rem", color: "var(--text-tertiary)" }}>
            {isEdit ? "Update transaction details" : "Create a new financial transaction"}
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
                    Transaction Type <span style={{ color: "#dc3545" }}>*</span>
                  </Form.Label>
                  <Form.Select
                    name="transactionType"
                    value={formData.transactionType}
                    onChange={handleChange}
                    required
                    style={{
                      borderRadius: "var(--radius-md)",
                      borderColor: "var(--border-medium)",
                      background: "var(--bg-input)",
                    }}
                  >
                    <option value="DEPOSIT">Deposit</option>
                    <option value="WITHDRAWAL">Withdrawal</option>
                    <option value="TRANSFER">Transfer</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    Amount <span style={{ color: "#dc3545" }}>*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="amount"
                    value={formData.amount}
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
              <Col md={formData.transactionType === "TRANSFER" ? 6 : 12}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    Account <span style={{ color: "#dc3545" }}>*</span>
                  </Form.Label>
                  <Form.Select
                    name="accountId"
                    value={formData.accountId}
                    onChange={handleChange}
                    required
                    style={{
                      borderRadius: "var(--radius-md)",
                      borderColor: "var(--border-medium)",
                      background: "var(--bg-input)",
                    }}
                  >
                    <option value="">Select an account</option>
                    {accounts.map((account) => (
                      <option
                        key={account.accountId}
                        value={account.accountId}
                      >
                        {account.accountNumber} - {account.customerName || `${account.customer?.firstName || ""} ${account.customer?.lastName || ""}`.trim()}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              {formData.transactionType === "TRANSFER" && (
                <Col md={6}>
                  <Form.Group>
                    <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                      Destination Account <span style={{ color: "#dc3545" }}>*</span>
                    </Form.Label>
                    <Form.Select
                      name="destinationAccountId"
                      value={formData.destinationAccountId}
                      onChange={handleChange}
                      required={formData.transactionType === "TRANSFER"}
                      style={{
                        borderRadius: "var(--radius-md)",
                        borderColor: "var(--border-medium)",
                        background: "var(--bg-input)",
                      }}
                    >
                      <option value="">Select destination account</option>
                      {accounts
                        .filter(
                          (account) =>
                            account.accountId !== parseInt(formData.accountId)
                        )
                        .map((account) => (
                          <option
                            key={account.accountId}
                            value={account.accountId}
                          >
                            {account.accountNumber} - {account.customerName || `${account.customer?.firstName || ""} ${account.customer?.lastName || ""}`.trim()}
                          </option>
                        ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              )}
            </Row>

            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                Description
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter transaction description..."
                style={{
                  borderRadius: "var(--radius-md)",
                  borderColor: "var(--border-medium)",
                  background: "var(--bg-input)",
                }}
              />
            </Form.Group>

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
                    {isEdit ? "Update Transaction" : "Create Transaction"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline-secondary"
                onClick={() => navigate("/transactions")}
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

export default TransactionForm;
